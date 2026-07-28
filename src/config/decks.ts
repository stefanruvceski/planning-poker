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
}

export const DECKS: Record<string, Deck> = {
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
export const DEFAULT_DECK_ID = "fibonacci";

export const getDeck = (id: string): Deck => DECKS[id] ?? DECKS[DEFAULT_DECK_ID];
