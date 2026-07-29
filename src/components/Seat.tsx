"use client";

import { avatarUrl } from "@/config/avatars";
import type { Player } from "@/lib/types";

interface Props {
  player: Player;
  isMe: boolean;
  /** The one running the table - dealer button sits with them. */
  isDealer: boolean;
  /** Only then may the vote be shown, so the table turns in one go. */
  showResults: boolean;
  /** Top of the tally so far - nobody wears it while everyone is on zero. */
  isLeader: boolean;
  /** Took this round's pot; briefly lights the count up. */
  wonRound: boolean;
}

/** Avatar + name plate, in the style of the old Zynga seat. */
export default function Seat({ player, isMe, isDealer, showResults, isLeader, wonRound }: Props) {
  const spectator = player.role === "spectator";

  return (
    <div className="flex w-16 flex-col items-center sm:w-28">
      <div className="relative">
        <img
          src={avatarUrl(player.avatarSeed)}
          alt={player.name}
          className={`h-11 w-11 rounded-full object-cover sm:h-16 sm:w-16 ${
            spectator ? "opacity-60 shadow-[0_0_0_3px_#64748b]" : "chip-ring"
          } ${player.hasVoted && !spectator ? "glow-turn" : ""}`}
        />
        {isDealer && (
          <span
            title="Dealer - runs the round"
            className="dealer-button absolute -right-1.5 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-slate-900 sm:h-6 sm:w-6 sm:text-[11px]"
          >
            D
          </span>
        )}
      </div>

      <div
        className={`mt-1.5 w-full truncate rounded-md px-2 py-0.5 text-center text-xs font-bold ${
          isMe ? "name-plate-me text-black" : "name-plate text-white"
        }`}
      >
        {player.name}
      </div>

      {spectator ? (
        <div className="mt-1 rounded-full border border-white/20 bg-white/10 px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider text-white/70">
          Spectator
        </div>
      ) : (
        <>
          {/* The chip count, exactly where the old table kept it. */}
          <div
            className={`table-label mt-0.5 flex items-center gap-1 text-sm font-extrabold transition-transform ${
              wonRound ? "scale-125 text-emerald-300" : "text-gold"
            }`}
          >
            {isLeader && <span title="Closest so far">👑</span>}
            <span className="chip chip-gold-mini" />
            {player.chips}
          </div>
          {!showResults && (
            <div className="table-label text-[10px] text-white/55">
              {player.hasVoted ? "Ready" : "Thinking…"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
