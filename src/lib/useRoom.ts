"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { DEFAULT_DECK_ID, getDeck, isDeckId } from "@/config/decks";
import { settlePot } from "./scoring";
import { computeStats } from "./stats";
import { supabase } from "./supabase";
import type { Player, PlayerRole } from "./types";

export interface Identity {
  id: string;
  name: string;
  avatarSeed: string;
  role: PlayerRole;
  joinedAt: number;
}

/** One estimated story, logged when its round is revealed - the session recap. */
export interface RecapEntry {
  /** The round's rev, so a refresh never logs the same round twice. */
  rev: number;
  story: string;
  /** Formatted estimate like "5d", or "—" when there were no numeric votes. */
  estimate: string;
  consensus: boolean;
  /** [value, count], the same breakdown the table shows. */
  distribution: [string, number][];
  at: number;
}

/** A row of the participants table, as it comes back from Postgres. */
interface ParticipantRow {
  room_id: string;
  player_id: string;
  name: string;
  avatar_seed: string;
  role: PlayerRole;
  has_voted: boolean;
  voted_rev: number;
  chips: number;
  joined_at: string;
  last_seen: string;
}

/** A row of the rooms table - the authoritative round state. */
interface RoomRow {
  id: string;
  deck_id: string;
  story: string;
  revealed: boolean;
  rev: number;
  deadline: string | null;
}

/** The round state we keep locally, mirrored from the rooms row. */
interface Round {
  rev: number;
  revealed: boolean;
  story: string;
  deckId: string;
  deadline: number | null;
}

/** How often each client marks itself alive, and how long since the last mark
 *  before a seat is treated as gone. Presence used to do this for us; now that
 *  the roster lives in the database, a heartbeat + TTL takes its place. */
const HEARTBEAT_MS = 12_000;
const ONLINE_TTL_MS = 40_000;

/** Reconcile straight from the database this often, as a safety net under the
 *  realtime stream: even if a change event is missed or delayed, the table
 *  converges within a couple of seconds. Realtime is still the fast path. */
const POLL_MS = 2500;

/** Backoff before rebuilding a realtime channel that dropped. */
const RECONNECT_DELAY_MS = 2000;

/** Chips are authoritative in the database now, but the round a client last paid
 *  a pot for still lives in sessionStorage, so a refresh mid-reveal never pays
 *  twice. */
const paidKey = (roomId: string) => `pp:${roomId}:paidRev`;
/** The deck a client seeds a brand-new room with (a typed ?deck= wins). */
const deckKey = (roomId: string) => `pp:${roomId}:deck`;
/** My own current selection, so a refresh mid-round keeps my card lit even
 *  though the vote value itself is never readable back out of the database. */
const voteKey = (roomId: string) => `pp:${roomId}:myvote`;
/** The session recap of estimated stories, kept per room like the chips were. */
const recapKey = (roomId: string) => `pp:${roomId}:recap`;

const nowMs = () => Date.now();
const iso = () => new Date().toISOString();

export function useRoom(roomId: string, me: Identity | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [story, setStoryState] = useState("");
  const [deckId, setDeckId] = useState(DEFAULT_DECK_ID);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [rev, setRev] = useState(0);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [recap, setRecap] = useState<RecapEntry[]>([]);
  /** Revealed vote values, keyed by player id - only ever populated by the RPC,
   *  which returns them only once the round is revealed. */
  const [revealedVotes, setRevealedVotes] = useState<Map<string, string>>(new Map());
  /** The rev the revealed votes belong to, so we only show them for this round. */
  const [revealedRev, setRevealedRev] = useState(-1);
  /** Bumped by the heartbeat tick so the online filter re-evaluates over time. */
  const [, setTick] = useState(0);
  /** Last database error, surfaced in the debug panel so a failing write (RLS,
   *  a missing migration) is visible instead of silently swallowed. */
  const [dbError, setDbError] = useState<string | null>(null);

  const channel = useRef<RealtimeChannel | null>(null);
  /** Local mirror of the participants table, keyed by player id. */
  const roster = useRef<Map<string, ParticipantRow>>(new Map());
  /** Current round, mirrored in a ref so async writers read fresh values. */
  const round = useRef<Round>({ rev: 0, revealed: false, story: "", deckId: DEFAULT_DECK_ID, deadline: null });
  /** Round the pot was last paid for, so it is never settled twice. */
  const paidRev = useRef(-1);
  /** Round last written to the recap, so a re-render never logs it twice. */
  const recapRev = useRef(-1);

  // Seed the per-client bits from sessionStorage before anything talks to the
  // database: the deck a new room should be created with, the last paid round,
  // my own current selection, and the recap so far.
  useEffect(() => {
    const paid = Number(sessionStorage.getItem(paidKey(roomId)));
    if (Number.isFinite(paid)) paidRev.current = paid;

    try {
      const stored = JSON.parse(sessionStorage.getItem(recapKey(roomId)) ?? "[]") as RecapEntry[];
      if (Array.isArray(stored) && stored.length) {
        setRecap(stored);
        recapRev.current = stored[stored.length - 1].rev;
      }
    } catch {
      // Corrupt entry - start the recap fresh rather than throwing.
    }

    const fromUrl = new URLSearchParams(window.location.search).get("deck");
    const fromStore = sessionStorage.getItem(deckKey(roomId));
    const chosen = isDeckId(fromUrl) ? fromUrl : isDeckId(fromStore) ? fromStore : DEFAULT_DECK_ID;
    round.current.deckId = chosen;
    setDeckId(chosen);
    sessionStorage.setItem(deckKey(roomId), chosen);
  }, [roomId]);

  /** Record a database error so it shows in the debug panel and the console,
   *  instead of being silently swallowed by a fire-and-forget write. */
  const note = useCallback((label: string, error: unknown) => {
    if (!error) return;
    const msg = (error as { message?: string })?.message ?? String(error);
    console.error(`[pp] ${label}:`, error);
    setDbError(`${label}: ${msg}`);
  }, []);

  /** Adopt a room row into local round state, clearing my vote when a fresh
   *  round opens (a new rev while not revealed) or the deck changes. */
  const applyRoom = useCallback(
    (row: RoomRow) => {
      const prev = round.current;
      const rowDeadline = row.deadline ? Date.parse(row.deadline) : null;
      // Polling calls this every couple of seconds; skip the state churn when the
      // room row hasn't actually changed.
      if (
        prev.rev === row.rev &&
        prev.revealed === row.revealed &&
        prev.story === row.story &&
        prev.deckId === row.deck_id &&
        prev.deadline === rowDeadline
      ) {
        return;
      }
      const newRound = row.rev !== prev.rev && !row.revealed;
      const deckChanged = row.deck_id !== prev.deckId;
      round.current = {
        rev: row.rev,
        revealed: row.revealed,
        story: row.story,
        deckId: row.deck_id,
        deadline: row.deadline ? Date.parse(row.deadline) : null,
      };
      setRev(row.rev);
      setRevealed(row.revealed);
      setStoryState(row.story);
      setDeadline(round.current.deadline);
      if (deckChanged) {
        setDeckId(row.deck_id);
        sessionStorage.setItem(deckKey(roomId), row.deck_id);
      }
      if (newRound || deckChanged) {
        setMyVote(null);
        sessionStorage.removeItem(voteKey(roomId));
      }
    },
    [roomId]
  );

  /** Rebuild the visible player list from the roster, dropping seats whose last
   *  heartbeat is older than the TTL (a closed tab that never got to clean up). */
  const rebuildPlayers = useCallback(() => {
    const cutoff = nowMs() - ONLINE_TTL_MS;
    const live = [...roster.current.values()]
      .filter((p) => Date.parse(p.last_seen) >= cutoff || p.player_id === me?.id)
      .sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at));
    const hostId = live[0]?.player_id;
    const r = round.current.rev;
    const showing = round.current.revealed && revealedRev === r;
    setPlayers(
      live.map((p) => ({
        id: p.player_id,
        name: p.name,
        avatarSeed: p.avatar_seed,
        role: p.role,
        hasVoted: p.has_voted && p.voted_rev === r,
        vote: showing ? revealedVotes.get(p.player_id) ?? null : null,
        chips: p.chips,
        isHost: p.player_id === hostId,
      }))
    );
  }, [me?.id, revealedVotes, revealedRev]);

  /** Read every participant of the room and replace the local mirror. Used on
   *  first load and after any reconnect, so the roster is always reconciled to
   *  the database rather than trusting a possibly-missed stream of changes. */
  const loadParticipants = useCallback(async () => {
    const { data, error } = await supabase.from("participants").select("*").eq("room_id", roomId);
    if (error) note("load participants", error);
    if (!data) return;
    const next = new Map<string, ParticipantRow>();
    for (const row of data as ParticipantRow[]) next.set(row.player_id, row);
    roster.current = next;
    rebuildPlayers();
  }, [roomId, rebuildPlayers, note]);

  /** Read the room row (creating it lazily if this is the first person in). */
  const loadRoom = useCallback(async () => {
    const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (error) note("load room", error);
    if (data) applyRoom(data as RoomRow);
  }, [roomId, applyRoom, note]);

  /** Pull the revealed votes for the current round through the gated RPC. */
  const loadRevealed = useCallback(async () => {
    const r = round.current.rev;
    const { data, error } = await supabase.rpc("revealed_votes", { p_room_id: roomId });
    if (error) note("load revealed", error);
    const map = new Map<string, string>();
    for (const row of (data ?? []) as { player_id: string; value: string }[]) {
      map.set(row.player_id, row.value);
    }
    setRevealedVotes(map);
    setRevealedRev(r);
  }, [roomId, note]);

  // When the round flips to revealed, fetch the values once. When it closes,
  // drop them so a stale set never leaks into the next round.
  useEffect(() => {
    if (revealed) {
      void loadRevealed();
    } else {
      setRevealedVotes(new Map());
      setRevealedRev(-1);
    }
  }, [revealed, rev, loadRevealed]);

  // Roster/round changes and the online-TTL tick all feed the visible list.
  useEffect(() => {
    rebuildPlayers();
  }, [rebuildPlayers, revealed, rev]);

  const me_id = me?.id;
  const me_role = me?.role;

  // The loaders change identity as their inputs change (rebuildPlayers, for one,
  // is rebuilt whenever the revealed votes arrive). We hold them in a ref so the
  // realtime setup below can call the latest version without listing them as
  // dependencies - otherwise the channel would tear down and rebuild on every
  // reveal, which is exactly what it must not do.
  const fns = useRef({ applyRoom, rebuildPlayers, loadRoom, loadParticipants, loadRevealed });
  fns.current = { applyRoom, rebuildPlayers, loadRoom, loadParticipants, loadRevealed };

  // Everything that talks to the database for this room, plus the realtime
  // subscription that keeps it live and recovers when the socket drops.
  useEffect(() => {
    if (!me) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let beat: ReturnType<typeof setInterval> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    /** Create the room if absent (seeding the deck), then take my seat. */
    const ensurePresence = async () => {
      const room = await supabase
        .from("rooms")
        .upsert({ id: roomId, deck_id: round.current.deckId }, { onConflict: "id", ignoreDuplicates: true });
      note("create room", room.error);
      // Omit chips / joined_at so a refresh keeps them; last_seen marks us alive.
      const seat = await supabase.from("participants").upsert(
        {
          room_id: roomId,
          player_id: me.id,
          name: me.name,
          avatar_seed: me.avatarSeed,
          role: me.role,
          last_seen: iso(),
        },
        { onConflict: "room_id,player_id" }
      );
      note("take seat", seat.error);
    };

    /** Mark myself alive and sweep out seats that stopped marking themselves. */
    const heartbeat = async () => {
      await supabase
        .from("participants")
        .update({ last_seen: iso() })
        .eq("room_id", roomId)
        .eq("player_id", me.id);
      await supabase
        .from("participants")
        .delete()
        .eq("room_id", roomId)
        .lt("last_seen", new Date(nowMs() - ONLINE_TTL_MS).toISOString());
      setTick((t) => t + 1); // re-evaluate the online filter locally too
    };

    const applyParticipantChange = (payload: {
      eventType: string;
      new: Partial<ParticipantRow>;
      old: Partial<ParticipantRow>;
    }) => {
      if (payload.eventType === "DELETE") {
        const id = payload.old.player_id;
        if (id) roster.current.delete(id);
      } else {
        const row = payload.new as ParticipantRow;
        if (row.player_id) roster.current.set(row.player_id, row);
      }
      fns.current.rebuildPlayers();
    };

    const connect = () => {
      if (disposed) return;
      const ch = supabase.channel(`room:${roomId}`, { config: { broadcast: { self: false } } });
      channel.current = ch;

      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as RoomRow;
          if (row?.id) fns.current.applyRoom(row);
        }
      );
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` },
        (payload) => applyParticipantChange(payload as never)
      );

      ch.subscribe((status) => {
        if (channel.current !== ch) return; // stale callback from a torn-down channel
        if (status === "SUBSCRIBED") {
          setConnected(true);
          // Reconcile to the database on every (re)connect: the change stream
          // only carries what happened while we were listening.
          void (async () => {
            await ensurePresence();
            await fns.current.loadRoom();
            await fns.current.loadParticipants();
            if (round.current.revealed) await fns.current.loadRevealed();
          })();
          return;
        }
        setConnected(false);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (retry) clearTimeout(retry);
          retry = setTimeout(reconnect, RECONNECT_DELAY_MS);
        }
      });
    };

    const reconnect = () => {
      if (disposed) return;
      const stale = channel.current;
      channel.current = null;
      if (stale) void supabase.removeChannel(stale);
      supabase.realtime.connect();
      connect();
    };

    const onWake = () => {
      if (disposed || document.visibilityState !== "visible") return;
      supabase.realtime.connect();
      if (channel.current?.state !== "joined") reconnect();
      else void heartbeat();
    };

    connect();
    beat = setInterval(heartbeat, HEARTBEAT_MS);
    // Safety net under realtime: reconcile the room + roster straight from the
    // database on a short interval, so a missed or dropped change event never
    // leaves the table wrong for more than a couple of seconds.
    poll = setInterval(() => {
      void fns.current.loadRoom();
      void fns.current.loadParticipants();
    }, POLL_MS);
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);
    // Best-effort clean exit so a closed tab frees its seat immediately rather
    // than waiting out the TTL.
    const onLeave = () => {
      void supabase.from("participants").delete().eq("room_id", roomId).eq("player_id", me.id);
    };
    window.addEventListener("pagehide", onLeave);

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      if (beat) clearInterval(beat);
      if (poll) clearInterval(poll);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pagehide", onLeave);
      onLeave();
      const ch = channel.current;
      channel.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
    // Built once per room + identity; the loaders are reached through fns.current
    // so a reveal never rebuilds the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, me_id, me_role]);

  // --- Actions. All of them are just writes to the database; realtime carries
  //     the result back to every client, this one included. ---

  const vote = useCallback(
    (value: string) => {
      if (!me || round.current.revealed || me.role === "spectator") return;
      const r = round.current.rev;
      const clearing = myVote === value;
      setDbError(null); // reflect this attempt, not a stale one

      // Reflect my own vote locally at once, so my card lights up and the counter
      // ticks without waiting for the write to echo back.
      const mine = roster.current.get(me.id);
      if (mine) {
        roster.current.set(me.id, { ...mine, has_voted: !clearing, voted_rev: r });
        rebuildPlayers();
      }
      setMyVote(clearing ? null : value);
      if (clearing) sessionStorage.removeItem(voteKey(roomId));
      else sessionStorage.setItem(voteKey(roomId), JSON.stringify({ rev: r, value }));

      void (async () => {
        // The vote value is written through a security-definer RPC, never
        // straight to the table, so it doesn't depend on a client write policy.
        if (clearing) {
          const d = await supabase.rpc("clear_vote", { p_room_id: roomId, p_player_id: me.id });
          note("clear vote", d.error);
        } else {
          const u = await supabase.rpc("cast_vote", {
            p_room_id: roomId,
            p_player_id: me.id,
            p_value: value,
            p_round_rev: r,
          });
          note("cast vote", u.error);
        }
        // .select() so we can tell a real update from one that matched no row -
        // a silent 0-row update is the classic "write succeeds but nothing
        // changes" case, and it would never surface as an error.
        const p = await supabase
          .from("participants")
          .update({ has_voted: !clearing, voted_rev: r, last_seen: iso() })
          .eq("room_id", roomId)
          .eq("player_id", me.id)
          .select();
        note("set has_voted", p.error);
        if (!p.error && (!p.data || p.data.length === 0)) {
          note("set has_voted", "no participant row matched my id — seat missing?");
        }
        // Reconcile straight from the database, so my own vote reflects the
        // persisted truth immediately even if realtime never delivers.
        await fns.current.loadParticipants();
      })();
    },
    [me, myVote, roomId, rebuildPlayers, note]
  );

  const patchRoom = useCallback(
    (patch: Partial<RoomRow>) =>
      void supabase
        .from("rooms")
        .update({ ...patch, updated_at: iso() })
        .eq("id", roomId)
        .then((res) => note("update room", res.error)),
    [roomId, note]
  );

  const reveal = useCallback(() => patchRoom({ revealed: true, deadline: null }), [patchRoom]);
  const reset = useCallback(() => {
    setMyVote(null);
    sessionStorage.removeItem(voteKey(roomId));
    patchRoom({ revealed: false, rev: round.current.rev + 1, deadline: null });
  }, [patchRoom, roomId]);
  const setStory = useCallback((text: string) => patchRoom({ story: text }), [patchRoom]);
  const setDeck = useCallback(
    (id: string) => patchRoom({ deck_id: id, revealed: false, rev: round.current.rev + 1, deadline: null }),
    [patchRoom]
  );
  const startTimer = useCallback(
    (seconds: number) => patchRoom({ deadline: new Date(nowMs() + seconds * 1000).toISOString() }),
    [patchRoom]
  );
  const cancelTimer = useCallback(() => patchRoom({ deadline: null }), [patchRoom]);

  // Restore my own selection after a refresh - the value can't be read back out
  // of the database (votes are write-only to clients), so it comes from
  // sessionStorage, and only if it belongs to the round still open.
  useEffect(() => {
    if (revealed || myVote !== null) return;
    try {
      const raw = sessionStorage.getItem(voteKey(roomId));
      if (!raw) return;
      const saved = JSON.parse(raw) as { rev: number; value: string };
      if (saved.rev === rev) setMyVote(saved.value);
    } catch {
      // ignore a corrupt entry
    }
  }, [roomId, rev, revealed, myVote]);

  const deck = getDeck(deckId);

  /** The whole round is on the table: it is revealed and its values are in. */
  const showResults = revealed && revealedRev === rev;

  /**
   * Settle the pot once the round is shown. Every client runs the same maths
   * over the same votes and picks the same winners, then each moves only its
   * own chip count (now a column in the database, so it survives a closed tab).
   * Guarded by rev so a re-render or a refresh never pays twice.
   */
  useEffect(() => {
    if (!showResults || !me) {
      setWinnerIds([]);
      return;
    }
    const stats = computeStats(players, deck);
    const { winners, each } = settlePot(players, deck, stats.average);
    setWinnerIds(winners);

    if (recapRev.current !== rev) {
      recapRev.current = rev;
      const entry: RecapEntry = {
        rev,
        story: round.current.story,
        estimate: stats.average !== null ? `${stats.average}${deck.suffix ?? ""}` : "—",
        consensus: stats.consensus,
        distribution: stats.distribution,
        at: nowMs(),
      };
      setRecap((prev) => {
        const next = [...prev, entry];
        sessionStorage.setItem(recapKey(roomId), JSON.stringify(next));
        return next;
      });
    }

    if (paidRev.current === rev) return;
    paidRev.current = rev;
    sessionStorage.setItem(paidKey(roomId), String(rev));
    if (winners.includes(me.id)) {
      const mine = roster.current.get(me.id);
      const chips = (mine?.chips ?? 0) + each;
      void supabase.from("participants").update({ chips }).eq("room_id", roomId).eq("player_id", me.id);
    }
  }, [showResults, players, deck, me, rev, roomId]);

  /**
   * Only the spectator runs the session (reveal / new round / story). If nobody
   * joined as a spectator the longest-seated player takes over, so the table is
   * never stuck.
   */
  const spectatorCount = players.filter((p) => p.role === "spectator").length;
  const canControl =
    !!me && (me.role === "spectator" || (spectatorCount === 0 && players[0]?.id === me.id));

  /** Whose seat carries the dealer button. */
  const facilitatorId = useMemo(
    () => players.find((p) => p.role === "spectator")?.id ?? players[0]?.id ?? "",
    [players]
  );

  /** When the timer lands, only the facilitator's client flips the reveal. */
  useEffect(() => {
    if (!canControl || revealed || deadline === null) return;
    const ms = deadline - nowMs();
    if (ms <= 0) {
      reveal();
      return;
    }
    const t = setTimeout(reveal, ms);
    return () => clearTimeout(t);
  }, [canControl, revealed, deadline, reveal]);

  /** Wipe the session recap (this client's copy of the log). */
  const clearRecap = useCallback(() => {
    recapRev.current = round.current.rev;
    setRecap([]);
    sessionStorage.removeItem(recapKey(roomId));
  }, [roomId]);

  return {
    players,
    /** Round state: locks voting the moment the facilitator flips it. */
    revealed,
    /** Display gate: true only once the whole round can be shown at once. */
    showResults,
    story,
    deckId,
    deadline,
    myVote,
    connected,
    canControl,
    facilitatorId,
    winnerIds,
    /** Last database error, or null - shown in the debug panel. */
    dbError,
    vote,
    reveal,
    reset,
    setStory,
    setDeck,
    startTimer,
    cancelTimer,
    recap,
    clearRecap,
  };
}
