import type { Deck } from "@/config/decks";
import type { Player } from "./types";

export interface VoteStats {
  average: number | null;
  consensus: boolean;
  /** [value, vote count] sorted descending */
  distribution: [string, number][];
  votedCount: number;
  totalPlayers: number;
  /** The lowest / highest numeric estimates, as their card labels (e.g. "2d"). */
  low: string | null;
  high: string | null;
  /** True when the estimates disagree enough to be worth a quick chat. */
  wideSpread: boolean;
}

/**
 * How far apart the estimates have to be before we flag disagreement: the top
 * estimate at least this many times the bottom one. Deliberately only the range
 * is surfaced, never who voted it, so nobody is singled out.
 */
const SPREAD_RATIO = 2;

/** Spectators are NEVER counted - that is the whole point of the role. */
export const votingPlayers = (players: Player[]) => players.filter((p) => p.role === "player");

export function computeStats(players: Player[], deck: Deck): VoteStats {
  const voters = votingPlayers(players);
  const votes = voters.map((p) => p.vote).filter((v): v is string => v !== null);
  const nonNumeric = new Set(deck.nonNumeric ?? []);
  // Keep each label alongside its worth, so we can name the low/high card.
  const numeric = votes
    .filter((v) => !nonNumeric.has(v))
    // A label like "3d" is not a number, so the deck says what it is worth.
    .map((v) => ({ label: v, n: deck.values?.[v] ?? Number(v) }))
    .filter((p) => !Number.isNaN(p.n));

  const counts = new Map<string, number>();
  votes.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));

  let low: string | null = null;
  let high: string | null = null;
  let wideSpread = false;
  if (numeric.length >= 2) {
    const min = numeric.reduce((a, b) => (b.n < a.n ? b : a));
    const max = numeric.reduce((a, b) => (b.n > a.n ? b : a));
    low = min.label;
    high = max.label;
    // Ratio when the floor is above zero; a zero next to any real estimate is
    // itself a disagreement worth naming.
    wideSpread = min.n > 0 ? max.n / min.n >= SPREAD_RATIO : max.n >= SPREAD_RATIO;
  }

  return {
    average: numeric.length ? Math.round((numeric.reduce((a, b) => a + b.n, 0) / numeric.length) * 10) / 10 : null,
    consensus: votes.length > 1 && new Set(votes).size === 1,
    distribution: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    votedCount: voters.filter((p) => p.hasVoted).length,
    totalPlayers: voters.length,
    low,
    high,
    wideSpread,
  };
}
