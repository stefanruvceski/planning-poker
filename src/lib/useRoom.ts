"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
  /** Lamport counter: highest rev wins, so every client converges on the same round. */
  rev: number;
  revealed: boolean;
  story: string;
}

interface Round {
  rev: number;
  revealed: boolean;
  /** Set by the facilitator; empty string means "show nothing". */
  story: string;
}

export function useRoom(roomId: string, me: Identity | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [story, setStoryState] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const channel = useRef<RealtimeChannel | null>(null);
  // Kept in a ref, not state: handlers run outside React's render cycle.
  const local = useRef<{ vote: string | null } & Round>({ vote: null, rev: 0, revealed: false, story: "" });

  /** Publish my current presence payload. */
  const push = useCallback(() => {
    const ch = channel.current;
    if (!ch || !me) return;
    const { vote, rev, revealed: isRevealed, story: currentStory } = local.current;
    const payload: Presence = {
      ...me,
      hasVoted: vote !== null,
      vote: isRevealed ? vote : null,
      rev,
      revealed: isRevealed,
      story: currentStory,
    };
    void ch.track(payload);
  }, [me]);

  /** Adopt a round (from a peer or from my own action) and re-publish. */
  const applyRound = useCallback(
    (next: Round) => {
      const roundChanged = next.revealed !== local.current.revealed;
      local.current.rev = next.rev;
      local.current.revealed = next.revealed;
      local.current.story = next.story;
      // Only a round flip clears votes - editing the story must not wipe them.
      if (roundChanged && !next.revealed) {
        local.current.vote = null;
        setMyVote(null);
      }
      setRevealed(next.revealed);
      setStoryState(next.story);
      push();
    },
    [push]
  );

  useEffect(() => {
    if (!me) return;

    const ch = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: me.id } },
    });
    channel.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const rows = Object.values(ch.presenceState<Presence>()).flat();
      rows.sort((a, b) => a.joinedAt - b.joinedAt);

      setPlayers(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          avatarSeed: r.avatarSeed,
          role: r.role,
          hasVoted: r.hasVoted,
          vote: r.vote,
          // whoever has been at the table longest wears the host star
          isHost: r.id === rows[0]?.id,
        }))
      );

      // A late joiner (or someone who missed a broadcast) catches up here.
      const newest = rows.reduce<Round>(
        (best, r) => (r.rev > best.rev ? r : best),
        { rev: -1, revealed: false, story: "" }
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

  /**
   * Only the spectator runs the session (reveal / new round / story) - the
   * people estimating just estimate. If nobody joined as a spectator the table
   * would be stuck, so the longest-seated player takes over instead.
   */
  const spectatorCount = players.filter((p) => p.role === "spectator").length;
  const canControl =
    !!me && (me.role === "spectator" || (spectatorCount === 0 && players[0]?.id === me.id));

  return {
    players,
    revealed,
    story,
    myVote,
    connected,
    canControl,
    vote,
    reveal: useCallback(() => publishRound({ revealed: true }), [publishRound]),
    reset: useCallback(() => publishRound({ revealed: false }), [publishRound]),
    setStory: useCallback((text: string) => publishRound({ story: text }), [publishRound]),
  };
}
