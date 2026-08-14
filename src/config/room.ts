import { DEFAULT_DECK_ID } from "./decks";

/**
 * Table settings. The deck is still code-defined here; the team list is no longer
 * - it now lives per brand in the database (see the `brands` table).
 */
export const ROOM_CONFIG = {
  deckId: DEFAULT_DECK_ID,
};

/**
 * A room id is brand-qualified, so two brands can both have a "platform" table
 * without colliding: `<brandId>__<slug>` (e.g. `tma__identity-payments`). The
 * URL is /room/<that>.
 */
const ROOM_SEP = "__";

export function makeRoomId(brandId: string, slug: string): string {
  return `${brandId}${ROOM_SEP}${slug}`;
}

export function parseRoomId(id: string): { brandId: string; slug: string } {
  const i = id.indexOf(ROOM_SEP);
  if (i < 0) return { brandId: "", slug: id };
  return { brandId: id.slice(0, i), slug: id.slice(i + ROOM_SEP.length) };
}

/** URL-safe slug from a free-text team or room name. */
export function slugifyRoom(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Readable label for a room id: the slug (brand prefix stripped) turned back
 * into words. Works for team tables and one-off rooms alike.
 */
export function roomLabel(id: string): string {
  const { slug } = parseRoomId(id);
  const words = slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length ? words.join(" ") : "Table";
}
