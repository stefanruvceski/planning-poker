import type { Deck } from "@/config/decks";
import { votingPlayers } from "./stats";
import type { Player } from "./types";

/** What a card is worth, or NaN if it is not an estimate at all. */
const estimate = (deck: Deck, vote: string | null): number =>
  vote === null ? NaN : deck.values?.[vote] ?? Number(vote);

/**
 * Everyone who put a real estimate on the table antes one chip, so the pot is
 * simply how many people estimated. "?" and the coffee card are not estimates:
 * they neither pay in nor play for the pot.
 */
export function contenders(players: Player[], deck: Deck) {
  return votingPlayers(players)
    .map((p) => ({ id: p.id, value: estimate(deck, p.vote) }))
    .filter((c) => !Number.isNaN(c.value));
}

/**
 * The pot goes to the estimate closest to the average - several people if they
 * are equally close, which is common on a small table.
 *
 * Every client runs this over the same votes at the same moment (once the round
 * has settled), so they all reach the same answer without another message on
 * the wire. Each client then only ever adjusts its own chip count.
 */
export function settlePot(players: Player[], deck: Deck, average: number | null) {
  const runners = contenders(players, deck);
  if (average === null || runners.length < 2) return { pot: 0, winners: [] as string[], each: 0 };

  const closest = Math.min(...runners.map((c) => Math.abs(c.value - average)));
  const winners = runners.filter((c) => Math.abs(c.value - average) === closest).map((c) => c.id);
  const pot = runners.length;

  // Split ties evenly; a remainder just stays on the table rather than being
  // invented out of nowhere.
  return { pot, winners, each: Math.max(1, Math.floor(pot / winners.length)) };
}
