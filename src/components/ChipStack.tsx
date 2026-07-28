"use client";

import { motion } from "framer-motion";
import type { Deck } from "@/config/decks";

/** Classic denominations, low to high. */
const TONES = ["chip-white", "chip-red", "chip-green", "chip-black", "chip-purple"];

/**
 * Which chip colour a vote gets. Only ever called once the round is shown -
 * colouring by value before the reveal would let anyone read the estimates
 * straight off the felt, which is exactly what the hidden vote prevents.
 */
export function chipTone(deck: Deck, vote: string | null): string {
  if (!vote) return "chip-hidden";
  const scale = deck.cards.filter((c) => !(deck.nonNumeric ?? []).includes(c));
  const rank = scale.indexOf(vote);
  // "?" and the coffee break are not on the scale, so they keep a plain chip.
  if (rank < 0) return "chip-hidden";
  return TONES[Math.min(TONES.length - 1, Math.floor((rank / scale.length) * TONES.length))];
}

interface Props {
  tone: string;
  /** Where the stack sits right now, in table percentages. */
  at: { x: number; y: number };
  /** Keeps neighbouring stacks from looking stamped out of the same mould. */
  jitter: number;
  faded: boolean;
}

export default function ChipStack({ tone, at, jitter, faded }: Props) {
  return (
    <motion.div
      className="pointer-events-none absolute h-[30px] w-5 -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{
        left: `${at.x}%`,
        top: `${at.y}%`,
        opacity: faded ? 0 : 1,
        scale: faded ? 0.6 : 1,
      }}
      transition={{ type: "spring", stiffness: 190, damping: 24 }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`chip ${tone} absolute left-0`}
          style={{ bottom: i * 5, transform: `translateX(${(i % 2 ? 1 : -1) * jitter}px)` }}
        />
      ))}
    </motion.div>
  );
}
