import type { Deck } from "@/config/decks";
import type { Player } from "./types";

export interface VoteStats {
  average: number | null;
  consensus: boolean;
  /** [value, vote count] sorted descending */
  distribution: [string, number][];
  votedCount: number;
  totalPlayers: number;
}

/** Spectators are NEVER counted - that is the whole point of the role. */
export const votingPlayers = (players: Player[]) => players.filter((p) => p.role === "player");

export function computeStats(players: Player[], deck: Deck): VoteStats {
  const voters = votingPlayers(players);
  const votes = voters.map((p) => p.vote).filter((v): v is string => v !== null);
  const nonNumeric = new Set(deck.nonNumeric ?? []);
  const numeric = votes.filter((v) => !nonNumeric.has(v)).map(Number).filter((n) => !Number.isNaN(n));

  const counts = new Map<string, number>();
  votes.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));

  return {
    average: numeric.length ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10 : null,
    consensus: votes.length > 1 && new Set(votes).size === 1,
    distribution: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    votedCount: voters.filter((p) => p.hasVoted).length,
    totalPlayers: voters.length,
  };
}
