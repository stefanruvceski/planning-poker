/**
 * Tests for the grace roster - the fix for "someone disappears when you reveal".
 * Run: npm test  (uses tsx). Plain asserts, no framework.
 */
import assert from "node:assert/strict";
import { reconcileRoster, rosterPlayers, type RosterEntry, type RosterPlayer } from "./roster";

const GRACE = 4000;

const player = (id: string, over: Partial<RosterPlayer> = {}): RosterPlayer => ({
  id,
  name: id,
  avatarSeed: id,
  role: "player",
  hasVoted: false,
  vote: null,
  chips: 0,
  joinedAt: id.charCodeAt(0),
  ...over,
});

const ids = (roster: Map<string, RosterEntry>) => rosterPlayers(roster).map((p) => p.id).sort();

let roster = new Map<string, RosterEntry>();
let t = 1000;

// 1) Everyone joins.
roster = reconcileRoster(roster, [player("A"), player("B"), player("C")], t, GRACE);
assert.deepEqual(ids(roster), ["A", "B", "C"], "all three seated");

// 2) Reveal churn: B blinks out of one snapshot while still connected.
t += 200;
roster = reconcileRoster(roster, [player("A"), player("C")], t, GRACE);
assert.deepEqual(ids(roster), ["A", "B", "C"], "B kept through the blip (was NOT dropped)");

// 3) B's revealed vote lands a moment later - B is back with fresh data.
t += 300;
roster = reconcileRoster(
  roster,
  [player("A", { hasVoted: true, vote: "5d" }), player("B", { hasVoted: true, vote: "8d" }), player("C", { hasVoted: true, vote: "5d" })],
  t,
  GRACE
);
assert.deepEqual(ids(roster), ["A", "B", "C"], "still all three");
assert.equal(rosterPlayers(roster).find((p) => p.id === "B")?.vote, "8d", "B's revealed vote is shown");

// 4) C actually leaves and stays gone past the grace window -> removed.
t += GRACE + 1;
roster = reconcileRoster(roster, [player("A"), player("B")], t, GRACE);
assert.deepEqual(ids(roster), ["A", "B"], "C removed after real departure");

// 5) Host star is always the longest-seated present player.
assert.equal(rosterPlayers(roster).find((p) => p.isHost)?.id, "A", "A wears the host star");

console.log("roster grace: all assertions passed ✓");
