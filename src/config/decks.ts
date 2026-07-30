/**
 * CARD DECKS
 * Edit the values here whenever you need to - no UI required.
 * Later: whoever creates a table picks a deckId, or defines a custom deck.
 */
export interface Deck {
  id: string;
  name: string;
  cards: string[];
  /** Cards excluded from the average */
  nonNumeric?: string[];
  /**
   * What a card is worth in the average, when the label itself is not a number
   * ("3d" -> 3). Cards missing here fall back to parsing the label.
   */
  values?: Record<string, number>;
  /** Appended to the average, so "5.5" reads as "5.5d". */
  suffix?: string;
  /**
   * Calibration examples pinned to the table edge: "a known 3d looks like X".
   * They anchor the team to a shared scale so "5d" means the same to everyone,
   * which matters most for a cross-country team. Edit here - no UI needed.
   */
  references?: { value: string; note: string }[];
}

export const DECKS: Record<string, Deck> = {
  days: {
    id: "days",
    name: "Days",
    cards: ["<1d", "2d", "3d", "4d", "5d", "6d", "7d", "8d", "9d", "10d", "?", "☕"],
    nonNumeric: ["?", "☕"],
    // "less than a day" counts as half a day, otherwise a table full of "<1d"
    // would have no average at all.
    values: {
      "<1d": 0.5,
      "2d": 2,
      "3d": 3,
      "4d": 4,
      "5d": 5,
      "6d": 6,
      "7d": 7,
      "8d": 8,
      "9d": 9,
      "10d": 10,
    },
    suffix: "d",
    // Placeholder examples - swap these for real tickets the team agrees on.
    references: [
      { value: "<1d", note: "Copy or config tweak" },
      { value: "3d", note: "Small feature, familiar area" },
      { value: "5d", note: "Feature across a few services" },
      { value: "8d", note: "New integration or migration" },
    ],
  },
  fibonacci: {
    id: "fibonacci",
    name: "Fibonacci",
    cards: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "?", "☕"],
    nonNumeric: ["?", "☕"],
  },
  tshirt: {
    id: "tshirt",
    name: "T-Shirt",
    cards: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
    nonNumeric: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
    references: [
      { value: "S", note: "Small, well understood" },
      { value: "M", note: "Standard feature" },
      { value: "L", note: "Big, some unknowns" },
      { value: "XL", note: "Too big — split it" },
    ],
  },
  powers: {
    id: "powers",
    name: "Powers of 2",
    cards: ["0", "1", "2", "4", "8", "16", "32", "64", "?", "☕"],
    nonNumeric: ["?", "☕"],
  },
};

/** Deck used by the default table */
export const DEFAULT_DECK_ID = "days";

/** Every deck, in insertion order - for the "create table" picker. */
export const DECK_LIST: Deck[] = Object.values(DECKS);

export const getDeck = (id: string): Deck => DECKS[id] ?? DECKS[DEFAULT_DECK_ID];

/** True when `id` names a real deck, so URL/stored ids can be trusted. */
export const isDeckId = (id: string | null | undefined): id is string =>
  !!id && id in DECKS;

/**
 * Keyboard key that votes the card at this position in the hand: 1-9 for the
 * first nine, 0 for the tenth, and nothing beyond (the `?`/`☕` tail stays
 * mouse-only). Shared by the hand's hints and the room's key handler so the
 * two never drift apart.
 */
export const cardHotkey = (index: number): string | null =>
  index < 9 ? String(index + 1) : index === 9 ? "0" : null;
