import type { Player } from "./types";

/** A player plus the join time we sort seats by (Player itself has no joinedAt). */
export type RosterPlayer = Player & { joinedAt: number };

/** A player at the table, plus when a presence snapshot last actually showed them. */
export interface RosterEntry {
  player: RosterPlayer;
  lastSeen: number;
}

/**
 * Merge a fresh presence snapshot into the roster, keeping players who blinked
 * out for less than `graceMs`.
 *
 * Why: Supabase re-emits a leave→join for a presence key every time that client
 * re-publishes - which every client does on the reveal, to attach its vote. So
 * a peer can be missing from a single sync snapshot while still perfectly
 * connected. Rebuilding the roster from scratch on each sync (the old behaviour)
 * dropped them for that instant, which is exactly the "someone disappears when
 * you reveal" bug. Grace rides over those blips: a peer is only removed once it
 * has been absent for longer than the grace window, i.e. it really left.
 *
 * Pure and time-injected so it can be unit-tested.
 */
export function reconcileRoster(
  prev: Map<string, RosterEntry>,
  present: RosterPlayer[],
  now: number,
  graceMs: number
): Map<string, RosterEntry> {
  const next = new Map<string, RosterEntry>();
  const presentIds = new Set(present.map((p) => p.id));

  // In the fresh snapshot: newest data, seen now.
  for (const p of present) next.set(p.id, { player: p, lastSeen: now });

  // Known but missing this time: keep their last-known data until grace expires.
  for (const [id, entry] of prev) {
    if (presentIds.has(id)) continue;
    if (now - entry.lastSeen <= graceMs) next.set(id, entry);
  }

  return next;
}

/**
 * The roster as the sorted player list the table renders: longest-seated first,
 * and that same seat wears the host star. Recomputed from the merged roster so
 * the ordering stays stable even while a peer is being held through grace.
 */
export function rosterPlayers(roster: Map<string, RosterEntry>): Player[] {
  const players = [...roster.values()].map((e) => e.player).sort((a, b) => a.joinedAt - b.joinedAt);
  return players.map((p) => ({ ...p, isHost: p.id === players[0]?.id }));
}

/** True while any entry is being held through grace (missing but not yet expired). */
export function hasGraceHold(roster: Map<string, RosterEntry>, now: number): boolean {
  for (const entry of roster.values()) if (entry.lastSeen !== now) return true;
  return false;
}
