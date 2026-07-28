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
      <div className="flex h-28 items-center justify-center text-sm text-white/50">
        You are the facilitator — you run the story, the reveal and the rounds, but you don&apos;t vote.
      </div>
    );
  }

  return (
    <div className="flex h-28 items-end justify-center gap-2 pb-5">
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
            className={`card-face flex h-[74px] w-[52px] items-center justify-center rounded-lg text-base font-bold text-slate-900 disabled:opacity-40 ${
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
