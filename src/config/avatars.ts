import { createAvatar, type Style } from "@dicebear/core";
import { bottts, adventurerNeutral, croodles } from "@dicebear/collection";

/**
 * Avatar styles - generated locally as SVG, no API calls.
 * Each style has its own option union, so they are stored behind a common
 * Style<> type; we only ever pass options every style understands.
 */
export type AvatarStyle = "bottts" | "adventurerNeutral" | "croodles";

const STYLES: Record<AvatarStyle, Style<Record<string, unknown>>> = {
  bottts,
  adventurerNeutral,
  croodles,
} as Record<AvatarStyle, Style<Record<string, unknown>>>;

/**
 * Silly robots: fun, colorful, and neutral - nothing that could read as
 * a person being sick, or as any real-world group.
 */
export const AVATAR_STYLE: AvatarStyle = "bottts";

const cache = new Map<string, string>();

export function avatarUrl(seed: string, style: AvatarStyle = AVATAR_STYLE): string {
  const key = `${style}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const svg = createAvatar(STYLES[style], {
    seed,
    radius: 50,
    backgroundColor: ["7dd3fc", "c4b5fd", "fda4af", "fcd34d", "86efac", "f9a8d4"],
  }).toString();

  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  cache.set(key, url);
  return url;
}

/** Random seed assigned when someone joins the table. */
export const randomSeed = () => Math.random().toString(36).slice(2, 10);
