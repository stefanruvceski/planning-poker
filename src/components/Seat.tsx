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
}

/** Avatar + name plate, in the style of the old Zynga seat. */
export default function Seat({ player, isMe, isDealer, showResults }: Props) {
  const spectator = player.role === "spectator";

  return (
    <div className="flex w-28 flex-col items-center">
      <div className="relative">
        <img
          src={avatarUrl(player.avatarSeed)}
          alt={player.name}
          className={`h-16 w-16 rounded-full object-cover ${
            spectator ? "opacity-60 shadow-[0_0_0_3px_#64748b]" : "chip-ring"
          } ${player.hasVoted && !spectator ? "glow-turn" : ""}`}
        />
        {isDealer && (
          <span
            title="Dealer - runs the round"
            className="dealer-button absolute -right-2 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-slate-900"
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
      ) : showResults && player.vote ? (
        /* Where the chip count used to sit on the old table. */
        <div className="table-label mt-0.5 text-sm font-extrabold text-gold">{player.vote}</div>
      ) : (
        <div className="table-label mt-0.5 text-[10px] text-white/55">
          {player.hasVoted ? "Ready" : "Thinking…"}
        </div>
      )}
    </div>
  );
}
