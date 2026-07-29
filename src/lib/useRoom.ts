"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
}

interface Round {
  rev: number;
  revealed: boolean;
  /** Set by the facilitator; empty string means "show nothing". */
  story: string;
  /** The deck in play. Changing it opens a fresh round on the new cards. */
  deckId: string;
}

/**
 * How long the table waits for the last vote to land before showing the round
 * anyway. A client that froze between the flip and its re-publish must not hold
 * everyone else hostage.
 */
const REVEAL_SETTLE_TIMEOUT_MS = 3000;

/** Chips outlive a refresh, the way the seat does. */
const chipsKey = (roomId: string) => `pp:${roomId}:chips`;
/** And so does the round they were last paid for, or reloading pays twice. */
const paidKey = (roomId: string) => `pp:${roomId}:paidRev`;
/** The deck sticks per room, so a refresh or a typed URL keeps it. */
const deckKey = (roomId: string) => `pp:${roomId}:deck`;

export function useRoom(roomId: string, me: Identity | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [story, setStoryState] = useState("");
  const [deckId, setDeckId] = useState(DEFAULT_DECK_ID);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [winnerIds, setWinnerIds] = useState<string[]>([]);

  const channel = useRef<RealtimeChannel | null>(null);
  /** Round the pot was last paid for, so it is never settled twice. */
  const paidRev = useRef(-1);
  // Kept in a ref, not state: handlers run outside React's render cycle.
  const local = useRef<{ vote: string | null; chips: number } & Round>({
    vote: null,
    chips: 0,
    rev: 0,
    revealed: false,
    story: "",
    deckId: DEFAULT_DECK_ID,
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
    const { vote, chips, rev, revealed: isRevealed, story: currentStory, deckId: currentDeck } = local.current;
    const payload: Presence = {
      ...me,
      hasVoted: vote !== null,
      vote: isRevealed ? vote : null,
      chips,
      rev,
      revealed: isRevealed,
      story: currentStory,
      deckId: currentDeck,
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
      // Votes clear when the round opens - and also when the deck changes, since
      // a "3d" vote is meaningless on a T-shirt deck. Editing the story does
      // neither, so it never wipes votes.
      if ((roundChanged && !next.revealed) || deckChanged) {
        local.current.vote = null;
        setMyVote(null);
      }
      setRevealed(next.revealed);
      setStoryState(next.story);
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

    const ch = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: me.id } },
    });
    channel.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      // One key is one player, but Supabase can hold several refs under it
      // while a superseded one expires - flattening those would seat the same
      // person twice. The last ref is the current payload.
      const rows = Object.values(ch.presenceState<Presence>()).flatMap((refs) => refs.slice(-1));
      rows.sort((a, b) => a.joinedAt - b.joinedAt);

      setPlayers(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          avatarSeed: r.avatarSeed,
          role: r.role,
          hasVoted: r.hasVoted,
          vote: r.vote,
          chips: r.chips ?? 0,
          // whoever has been at the table longest wears the host star
          isHost: r.id === rows[0]?.id,
        }))
      );

      // A late joiner (or someone who missed a broadcast) catches up here.
      const newest = rows.reduce<Round>(
        (best, r) => (r.rev > best.rev ? r : best),
        { rev: -1, revealed: false, story: "", deckId: local.current.deckId }
      );
      if (newest.rev > local.current.rev) applyRound(newest);
    });

    ch.on("broadcast", { event: "round" }, ({ payload }) => {
      const next = payload as Round;
      if (next.rev > local.current.rev) applyRound(next);
    });

    ch.subscribe((status) => {
      const live = status === "SUBSCRIBED";
      setConnected(live);
      if (live) push();
    });

    return () => {
      channel.current = null;
      void supabase.removeChannel(ch);
    };
  }, [roomId, me, applyRound, push]);

  const publishRound = useCallback(
    (patch: Partial<Round>) => {
      const next: Round = {
        rev: local.current.rev + 1,
        revealed: local.current.revealed,
        story: local.current.story,
        deckId: local.current.deckId,
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
    const { winners, each } = settlePot(players, deck, computeStats(players, deck).average);
    setWinnerIds(winners);

    // Never settle on a partial round. The timeout above opens the table when a
    // straggler is slow, but the pot must wait for the real vote set - paying
    // out on the votes that happened to have arrived hands chips to the wrong
    // player, and the average moves the moment the last one lands. When it does,
    // this effect runs again and pays properly.
    if (awaitingVotes) return;

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

  return {
    players,
    /** Round state: locks voting the moment the facilitator flips it. */
    revealed,
    /** Display gate: true only once the whole round can be shown at once. */
    showResults,
    story,
    /** The deck currently in play - the source of truth is the channel. */
    deckId,
    myVote,
    connected,
    canControl,
    facilitatorId,
    /** Who takes this round's pot - drives the payout animation. */
    winnerIds,
    vote,
    reveal: useCallback(() => publishRound({ revealed: true }), [publishRound]),
    reset: useCallback(() => publishRound({ revealed: false }), [publishRound]),
    setStory: useCallback((text: string) => publishRound({ story: text }), [publishRound]),
    /** Facilitator picks the deck; it opens a fresh round on the new cards. */
    setDeck: useCallback((id: string) => publishRound({ deckId: id, revealed: false }), [publishRound]),
  };
}
