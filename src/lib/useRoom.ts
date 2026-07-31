"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { DEFAULT_DECK_ID, getDeck, isDeckId } from "@/config/decks";
import { reconcileRoster, rosterPlayers, hasGraceHold, type RosterEntry, type RosterPlayer } from "./roster";
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

/** What every client publishes about itself into the channel. */
interface Presence extends Identity {
  hasVoted: boolean;
  /** Stays null until the round is revealed - the value never leaves the browser before that. */
  vote: string | null;
  /** Chips won so far. Each client only ever changes its own - see the award effect. */
  chips: number;
  /** Lamport counter: highest rev wins, so every client converges on the same round. */
  rev: number;
  revealed: boolean;
  story: string;
  /** Which deck the table is playing - shared like the story, set by the facilitator. */
  deckId: string;
  /** Epoch ms the round auto-reveals at, or null for no timer. Shared like the round. */
  deadline: number | null;
}

interface Round {
  rev: number;
  revealed: boolean;
  /** Set by the facilitator; empty string means "show nothing". */
  story: string;
  /** The deck in play. Changing it opens a fresh round on the new cards. */
  deckId: string;
  /** When the voting timer fires (epoch ms), or null when none is running. */
  deadline: number | null;
}

/**
 * How long the table waits for the last vote to land before showing the round
 * anyway. A client that froze between the flip and its re-publish must not hold
 * everyone else hostage.
 */
const REVEAL_SETTLE_TIMEOUT_MS = 3000;

/**
 * How long a player may be missing from presence snapshots before we drop them
 * from the table. Every client re-publishes its presence on the reveal (to
 * attach its vote), and Supabase turns each re-publish into a leave→join, so a
 * peer routinely vanishes from a single snapshot while still connected. Holding
 * them for this window rides over those blips - the "someone disappears when you
 * reveal" bug - while a peer who truly left is still removed shortly after.
 */
const PRESENCE_GRACE_MS = 4000;

/** How long to wait before rebuilding a channel that dropped, so a flapping
 *  connection backs off instead of hammering rejoins. */
const RECONNECT_DELAY_MS = 2000;

/** Chips outlive a refresh, the way the seat does. */
const chipsKey = (roomId: string) => `pp:${roomId}:chips`;
/** And so does the round they were last paid for, or reloading pays twice. */
const paidKey = (roomId: string) => `pp:${roomId}:paidRev`;
/** The deck sticks per room, so a refresh or a typed URL keeps it. */
const deckKey = (roomId: string) => `pp:${roomId}:deck`;
/** The session recap of estimated stories, kept per room like the chips. */
const recapKey = (roomId: string) => `pp:${roomId}:recap`;

export function useRoom(roomId: string, me: Identity | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [story, setStoryState] = useState("");
  const [deckId, setDeckId] = useState(DEFAULT_DECK_ID);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [recap, setRecap] = useState<RecapEntry[]>([]);

  const channel = useRef<RealtimeChannel | null>(null);
  /** Grace roster: last-known player by id, so a blip doesn't drop anyone. */
  const roster = useRef<Map<string, RosterEntry>>(new Map());
  /** Round the pot was last paid for, so it is never settled twice. */
  const paidRev = useRef(-1);
  /** Round last written to the recap, so a re-render never logs it twice. */
  const recapRev = useRef(-1);
  // Kept in a ref, not state: handlers run outside React's render cycle.
  const local = useRef<{ vote: string | null; chips: number } & Round>({
    vote: null,
    chips: 0,
    rev: 0,
    revealed: false,
    story: "",
    deckId: DEFAULT_DECK_ID,
    deadline: null,
  });

  // Read the running total back before the first publish, so a refresh mid
  // planning does not quietly reset the player to zero. The deck is resolved
  // here too: ?deck= from the invite link wins, then the per-room value, then
  // the default. (Runs on the client, so window/sessionStorage are available.)
  useEffect(() => {
    const saved = Number(sessionStorage.getItem(chipsKey(roomId)));
    if (Number.isFinite(saved) && saved > 0) local.current.chips = saved;
    const paid = Number(sessionStorage.getItem(paidKey(roomId)));
    if (Number.isFinite(paid)) paidRev.current = paid;

    // Read the recap back so a refresh keeps the session's estimated stories.
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
    local.current.deckId = chosen;
    setDeckId(chosen);
    sessionStorage.setItem(deckKey(roomId), chosen);
  }, [roomId]);

  /** Publish my current presence payload. */
  const push = useCallback(() => {
    const ch = channel.current;
    if (!ch || !me) return;
    const { vote, chips, rev, revealed: isRevealed, story: currentStory, deckId: currentDeck, deadline: currentDeadline } = local.current;
    const payload: Presence = {
      ...me,
      hasVoted: vote !== null,
      vote: isRevealed ? vote : null,
      chips,
      rev,
      revealed: isRevealed,
      story: currentStory,
      deckId: currentDeck,
      deadline: currentDeadline,
    };
    void ch.track(payload);
  }, [me]);

  /** Adopt a round (from a peer or from my own action) and re-publish. */
  const applyRound = useCallback(
    (next: Round) => {
      const roundChanged = next.revealed !== local.current.revealed;
      const deckChanged = next.deckId !== local.current.deckId;
      local.current.rev = next.rev;
      local.current.revealed = next.revealed;
      local.current.story = next.story;
      local.current.deckId = next.deckId;
      local.current.deadline = next.deadline;
      // Votes clear when the round opens - and also when the deck changes, since
      // a "3d" vote is meaningless on a T-shirt deck. Editing the story or the
      // timer does neither, so neither wipes votes.
      if ((roundChanged && !next.revealed) || deckChanged) {
        local.current.vote = null;
        setMyVote(null);
      }
      setRevealed(next.revealed);
      setStoryState(next.story);
      setDeadline(next.deadline);
      if (deckChanged) {
        setDeckId(next.deckId);
        sessionStorage.setItem(deckKey(roomId), next.deckId);
      }
      push();
    },
    [push, roomId]
  );

  useEffect(() => {
    if (!me) return;

    let disposed = false;
    let sweep: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    /**
     * Rebuild the table from the current presence snapshot, but through the
     * grace roster so a peer that blinked out (a reveal re-publish, a momentary
     * drop) is kept for a few seconds instead of vanishing. Called on every sync
     * and, while someone is being held, again on a timer so a true leaver is
     * still cleared even if no further sync arrives.
     */
    const recompute = () => {
      const ch = channel.current;
      if (!ch) return;
      // One key is one player, but Supabase can hold several refs under a key
      // while a superseded one expires - the last ref is the current payload.
      const rows = Object.values(ch.presenceState<Presence>()).flatMap((refs) => refs.slice(-1));
      const present: RosterPlayer[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        avatarSeed: r.avatarSeed,
        role: r.role,
        hasVoted: r.hasVoted,
        vote: r.vote,
        chips: r.chips ?? 0,
        joinedAt: r.joinedAt,
      }));
      const now = Date.now();
      roster.current = reconcileRoster(roster.current, present, now, PRESENCE_GRACE_MS);
      setPlayers(rosterPlayers(roster.current));

      if (sweep) clearTimeout(sweep);
      if (hasGraceHold(roster.current, now)) sweep = setTimeout(recompute, PRESENCE_GRACE_MS + 100);
    };

    /** A late joiner (or someone who missed a broadcast) catches up here. */
    const catchUp = () => {
      const ch = channel.current;
      if (!ch) return;
      const rows = Object.values(ch.presenceState<Presence>()).flatMap((refs) => refs.slice(-1));
      const newest = rows.reduce<Round>(
        (best, r) => (r.rev > best.rev ? r : best),
        { rev: -1, revealed: false, story: "", deckId: local.current.deckId, deadline: local.current.deadline }
      );
      if (newest.rev > local.current.rev) applyRound(newest);
    };

    const connect = () => {
      if (disposed) return;
      const ch = supabase.channel(`room:${roomId}`, {
        config: { presence: { key: me.id } },
      });
      channel.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        recompute();
        catchUp();
      });

      ch.on("broadcast", { event: "round" }, ({ payload }) => {
        const next = payload as Round;
        if (next.rev > local.current.rev) applyRound(next);
      });

      ch.subscribe((status) => {
        // A callback from a channel we've already torn down (a stale CLOSED as we
        // rebuild) must not touch state or schedule another reconnect.
        if (channel.current !== ch) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          push(); // re-publish our seat + current round so peers re-converge
          return;
        }
        setConnected(false);
        // The socket dropped - a laptop sleep, a network switch, a backgrounded
        // tab - and Supabase left the channel errored instead of rejoining it.
        // That is what strands a client on conn=false forever (seen in the debug
        // panel: one side revealed, the other still voting). Rebuild the channel
        // on a short backoff so it actually recovers.
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
      // Make sure the underlying socket is alive; a fresh channel then rejoins.
      supabase.realtime.connect();
      connect();
    };

    // Returning to a backgrounded tab, or the network coming back, is the usual
    // moment a dead socket needs a shove. Rejoin if we are not cleanly joined.
    const onWake = () => {
      if (disposed || document.visibilityState !== "visible") return;
      supabase.realtime.connect();
      if (channel.current?.state !== "joined") reconnect();
    };

    connect();
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      disposed = true;
      if (sweep) clearTimeout(sweep);
      if (retry) clearTimeout(retry);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
      roster.current = new Map();
      const ch = channel.current;
      channel.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [roomId, me, applyRound, push]);

  const publishRound = useCallback(
    (patch: Partial<Round>) => {
      const next: Round = {
        rev: local.current.rev + 1,
        revealed: local.current.revealed,
        story: local.current.story,
        deckId: local.current.deckId,
        deadline: local.current.deadline,
        ...patch,
      };
      applyRound(next);
      void channel.current?.send({ type: "broadcast", event: "round", payload: next });
    },
    [applyRound]
  );

  const vote = useCallback(
    (value: string) => {
      if (local.current.revealed) return;
      local.current.vote = local.current.vote === value ? null : value;
      setMyVote(local.current.vote);
      push();
    },
    [push]
  );

  // Revealing or opening a new round always stops any running timer.
  const reveal = useCallback(() => publishRound({ revealed: true, deadline: null }), [publishRound]);
  const reset = useCallback(() => publishRound({ revealed: false, deadline: null }), [publishRound]);
  /** Facilitator starts the voting timer; cancel by passing null seconds. */
  const startTimer = useCallback(
    (seconds: number) => publishRound({ deadline: Date.now() + seconds * 1000 }),
    [publishRound]
  );
  const cancelTimer = useCallback(() => publishRound({ deadline: null }), [publishRound]);

  /** Wipe the session recap. Only clears this client's copy of the log. */
  const clearRecap = useCallback(() => {
    recapRev.current = local.current.rev; // don't re-log the round on screen now
    setRecap([]);
    sessionStorage.removeItem(recapKey(roomId));
  }, [roomId]);

  const deck = getDeck(deckId);

  /**
   * The reveal has to land as one event. Each client re-publishes its own vote
   * only once the round flips, so the values arrive one payload at a time; if
   * the table rendered them as they came, the cards would turn one by one and
   * the average would jump with every arrival. So we hold the whole result back
   * until every player who voted has published a value - or until the timeout
   * gives up on a straggler.
   */
  const awaitingVotes = players.some((p) => p.role === "player" && p.hasVoted && p.vote === null);
  const [settleTimedOut, setSettleTimedOut] = useState(false);

  useEffect(() => {
    if (!revealed) {
      setSettleTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setSettleTimedOut(true), REVEAL_SETTLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  const showResults = revealed && (!awaitingVotes || settleTimedOut);

  /**
   * Settle the pot the moment the round is whole. Every client runs the same
   * calculation over the same votes, so they all pick the same winners without
   * another message on the wire - and each one only ever moves its own counter,
   * so a client that somehow disagreed could not corrupt anybody else's total.
   *
   * Guarded by rev, or a re-render would pay the pot out twice.
   */
  useEffect(() => {
    if (!showResults || !me) {
      setWinnerIds([]);
      return;
    }
    const stats = computeStats(players, deck);
    const { winners, each } = settlePot(players, deck, stats.average);
    setWinnerIds(winners);

    // Never settle on a partial round. The timeout above opens the table when a
    // straggler is slow, but the pot must wait for the real vote set - paying
    // out on the votes that happened to have arrived hands chips to the wrong
    // player, and the average moves the moment the last one lands. When it does,
    // this effect runs again and pays properly.
    if (awaitingVotes) return;

    // Log this revealed round to the session recap, once per round (like the
    // pot). Every client computes the same stats, so each keeps an identical
    // local copy - no new message on the wire.
    if (recapRev.current !== local.current.rev) {
      recapRev.current = local.current.rev;
      const entry: RecapEntry = {
        rev: local.current.rev,
        story: local.current.story,
        estimate: stats.average !== null ? `${stats.average}${deck.suffix ?? ""}` : "—",
        consensus: stats.consensus,
        distribution: stats.distribution,
        at: Date.now(),
      };
      setRecap((prev) => {
        const next = [...prev, entry];
        sessionStorage.setItem(recapKey(roomId), JSON.stringify(next));
        return next;
      });
    }

    if (paidRev.current === local.current.rev) return;
    paidRev.current = local.current.rev;
    sessionStorage.setItem(paidKey(roomId), String(paidRev.current));

    if (winners.includes(me.id)) {
      local.current.chips += each;
      sessionStorage.setItem(chipsKey(roomId), String(local.current.chips));
      push();
    }
  }, [showResults, awaitingVotes, players, deck, me, roomId, push]);

  /**
   * Only the spectator runs the session (reveal / new round / story) - the
   * people estimating just estimate. If nobody joined as a spectator the table
   * would be stuck, so the longest-seated player takes over instead.
   */
  const spectatorCount = players.filter((p) => p.role === "spectator").length;
  const canControl =
    !!me && (me.role === "spectator" || (spectatorCount === 0 && players[0]?.id === me.id));

  /**
   * Whose seat the dealer button sits on. Control itself stays with every
   * spectator, as above - this only picks the one seat to badge, so a table
   * with two spectators does not sprout two dealers.
   */
  const facilitatorId = players.find((p) => p.role === "spectator")?.id ?? players[0]?.id ?? "";

  /**
   * When the voting timer lands, only the facilitator's client flips the reveal
   * - one authority firing it, and reveal clears the deadline so it happens
   * once. Everyone else just watches their countdown reach zero.
   */
  useEffect(() => {
    if (!canControl || revealed || deadline === null) return;
    const ms = deadline - Date.now();
    if (ms <= 0) {
      reveal();
      return;
    }
    const t = setTimeout(reveal, ms);
    return () => clearTimeout(t);
  }, [canControl, revealed, deadline, reveal]);

  return {
    players,
    /** Round state: locks voting the moment the facilitator flips it. */
    revealed,
    /** Display gate: true only once the whole round can be shown at once. */
    showResults,
    story,
    /** The deck currently in play - the source of truth is the channel. */
    deckId,
    /** When the voting timer fires (epoch ms), or null for no timer. */
    deadline,
    myVote,
    connected,
    canControl,
    facilitatorId,
    /** Who takes this round's pot - drives the payout animation. */
    winnerIds,
    vote,
    reveal,
    reset,
    setStory: useCallback((text: string) => publishRound({ story: text }), [publishRound]),
    /** Facilitator picks the deck; it opens a fresh round on the new cards. */
    setDeck: useCallback((id: string) => publishRound({ deckId: id, revealed: false, deadline: null }), [publishRound]),
    /** Facilitator starts a countdown that auto-reveals when it hits zero. */
    startTimer,
    /** Facilitator stops a running countdown without revealing. */
    cancelTimer,
    /** Every story estimated this session, oldest first. */
    recap,
    /** Wipe this client's session recap. */
    clearRecap,
  };
}
