"use client";

import { motion } from "framer-motion";
import type { Deck } from "@/config/decks";

interface Props {
  deck: Deck;
  myVote: string | null;
  disabled: boolean;
  spectator: boolean;
  onPick: (value: string) => void;
}

/** My hand - cards at the bottom of the screen, lifting on hover. */
export default function HandDeck({ deck, myVote, disabled, spectator, onPick }: Props) {
  if (spectator) {
    return (
      <div className="flex h-24 items-center justify-center px-4 text-center text-xs text-white/50 sm:h-28 sm:text-sm">
        You are the facilitator — you run the story, the reveal and the rounds, but you don&apos;t vote.
      </div>
    );
  }

  return (
    // A full deck is wider than a phone, so the hand scrolls sideways there and
    // just centres on a wide screen.
    <div className="flex h-24 items-end justify-start gap-1.5 overflow-x-auto px-3 pb-4 sm:h-28 sm:justify-center sm:gap-2 sm:pb-5">
      {deck.cards.map((c) => {
        const selected = myVote === c;
        return (
          <motion.button
            key={c}
            onClick={() => onPick(c)}
            disabled={disabled}
            whileHover={disabled ? undefined : { y: -14 }}
            animate={{ y: selected ? -14 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`card-face flex h-[58px] w-[42px] shrink-0 items-center justify-center rounded-lg text-sm font-bold text-slate-900 disabled:opacity-40 sm:h-[74px] sm:w-[52px] sm:text-base ${
              selected ? "shadow-[0_0_0_3px_var(--color-gold)]" : ""
            }`}
          >
            {c}
          </motion.button>
        );
      })}
    </div>
  );
}
