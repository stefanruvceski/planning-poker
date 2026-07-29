import { DEFAULT_DECK_ID } from "./decks";

/**
 * Table settings. Code-defined for now - later these move into a "create table"
 * form and are stored per room.
 */
export const ROOM_CONFIG = {
  name: "Sprint Planning",
  deckId: DEFAULT_DECK_ID,
};

/**
 * The teams that get a standing table. `id` is the URL slug (/room/<id>) and
 * `label` is what the lobby and the table show. Add or rename a team here - no
 * UI needed. Order is the order the lobby lists them in.
 */
export const TEAM_ROOMS = [
  { id: "identity-payments", label: "Identity Payments" },
  { id: "engagement", label: "Engagement" },
  { id: "connectivity", label: "Connectivity" },
  { id: "compliance-reporting", label: "Compliance Reporting" },
] as const;

/** URL-safe slug from a free-text room name typed in the lobby's create box. */
export function slugifyRoom(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Display name for a room id: a known team's label, otherwise the slug turned
 * back into words. Keeps the table header readable for custom rooms too.
 */
export function roomLabel(id: string): string {
  const team = TEAM_ROOMS.find((room) => room.id === id);
  if (team) return team.label;
  const words = id
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length ? words.join(" ") : ROOM_CONFIG.name;
}
