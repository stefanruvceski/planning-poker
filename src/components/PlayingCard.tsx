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
  const dims = size === "sm" ? "w-11 h-16 text-xl" : "w-14 h-20 text-2xl";

  if (!hasVoted) {
    return (
      <div
        className={`${dims} rounded-lg border-2 border-dashed border-white/25 bg-black/15`}
        aria-label="No vote yet"
      />
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
