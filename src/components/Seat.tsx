"use client";

import { avatarUrl } from "@/config/avatars";
import type { Player } from "@/lib/types";

interface Props {
  player: Player;
  isMe: boolean;
}

/** Avatar + name plate, in the style of the old Zynga seat. */
export default function Seat({ player, isMe }: Props) {
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
        {player.isHost && (
          <span className="absolute -right-1 -top-1 rounded-full bg-gold px-1.5 text-[10px] font-bold text-black shadow">
            ★
          </span>
        )}
      </div>

      <div
        className={`mt-1.5 w-full truncate rounded-md px-2 py-0.5 text-center text-xs font-semibold shadow-md ${
          isMe ? "bg-gold text-black" : "bg-black/70 text-white"
        }`}
      >
        {player.name}
      </div>
      {spectator ? (
        <div className="mt-1 rounded-full border border-white/20 bg-white/10 px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider text-white/70">
          Spectator
        </div>
      ) : (
        <div className="mt-0.5 text-[10px] text-white/50">
          {player.hasVoted ? "Ready" : "Thinking…"}
        </div>
      )}
    </div>
  );
}
