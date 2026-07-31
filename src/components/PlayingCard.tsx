"use client";

import { motion } from "framer-motion";

interface Props {
  value: string | null;
  revealed: boolean;
  /** false = player has not voted yet (empty slot) */
  hasVoted: boolean;
  size?: "sm" | "md";
}

/** Card on the table: face down until reveal, then flips to its value. */
export default function PlayingCard({ value, revealed, hasVoted, size = "sm" }: Props) {
  // Wide enough for a three-character label like "<1d" without shrinking it.
  // The table (size "sm") scales down on a phone so cards don't crowd the seats.
  const dims =
    size === "sm"
      ? "w-9 h-[52px] text-xs sm:w-14 sm:h-[76px] sm:text-base"
      : "w-16 h-[92px] text-xl";

  if (!hasVoted) {
    return (
      <div
        className={`${dims} rounded-lg border-2 border-dashed border-white/25 bg-black/15`}
        aria-label="No vote yet"
      />
    );
  }

  // Revealed, but this player's value never reached us - a client that was slow
  // to adopt the reveal, or that blipped off presence mid-round. Show it as a
  // vote that didn't land, never a blank card face: a blank face reads as a real
  // (empty) estimate and is exactly the "card stuck as if someone voted" bug.
  if (revealed && value === null) {
    return (
      <div
        className={`${dims} flex items-center justify-center rounded-lg border-2 border-dashed border-amber-300/45 bg-black/25 font-bold text-amber-300/70`}
        aria-label="Vote didn't arrive"
      >
        …
      </div>
    );
  }

  return (
    <div className={`${dims} [perspective:800px]`}>
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <div className="card-back absolute inset-0 rounded-lg [backface-visibility:hidden]" />
        <div
          className="card-face absolute inset-0 flex items-center justify-center rounded-lg font-bold text-slate-900 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          {value}
        </div>
      </motion.div>
    </div>
  );
}
