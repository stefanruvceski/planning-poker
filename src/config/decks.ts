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
