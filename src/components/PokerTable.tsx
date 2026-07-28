"use client";

import { getDeck } from "@/config/decks";
import { computeStats } from "@/lib/stats";
import type { RoomState } from "@/lib/types";
import PlayingCard from "./PlayingCard";
import Seat from "./Seat";
import StoryBar from "./StoryBar";

interface Props {
  room: RoomState;
  meId: string;
  /** True only for the facilitator - the spectator running the session. */
  canControl: boolean;
  /**
   * The round is revealed AND every vote has arrived. Cards and numbers are
   * driven by this, never by room.revealed, so the table turns in one go
   * instead of card by card as the payloads trickle in.
   */
  showResults: boolean;
  onReveal: () => void;
  onReset: () => void;
  onStory: (text: string) => void;
}

/**
 * Seats are placed on a squircle (superellipse), not a plain ellipse - that
 * follows the stadium shape of a real poker table and spreads the side seats
 * out instead of bunching them on a curve. "Me" is always at the bottom.
 */
function seatPositions(count: number) {
  const EXP = 2 / 4; // higher denominator = boxier shape
  const sq = (v: number) => Math.sign(v) * Math.abs(v) ** EXP;

  return Array.from({ length: count }, (_, i) => {
    const rad = ((90 + (360 / count) * i) * Math.PI) / 180;
    const ux = sq(Math.cos(rad));
    const uy = sq(Math.sin(rad));
    return {
      seat: { x: 50 + 49 * ux, y: 50 + 46 * uy },
      // cards sit well inside the felt so they never crowd the avatars
      card: { x: 50 + 23 * ux, y: 50 + 24 * uy },
    };
  });
}

export default function PokerTable({ room, meId, canControl, showResults, onReveal, onReset, onStory }: Props) {
  const stats = computeStats(room.players, getDeck(room.deckId));

  const meIndex = room.players.findIndex((p) => p.id === meId);
  const ordered = meIndex > 0 ? [...room.players.slice(meIndex), ...room.players.slice(0, meIndex)] : room.players;
  const pos = seatPositions(ordered.length);

  return (
    <div className="relative aspect-[16/8.5] h-full w-auto max-h-full max-w-full">
      {/* Rail + felt: stadium shape, like a real poker table */}
      <div className="rail absolute inset-x-[7%] inset-y-[14%] rounded-full p-3">
        <div className="felt relative flex h-full w-full items-center justify-center rounded-full">
          {/* Table centre */}
          <div className="flex flex-col items-center gap-2 text-center">
            <StoryBar story={room.story ?? ""} editable={canControl} onChange={onStory} />

            {room.revealed && !showResults ? (
              <div className="rounded-full bg-black/25 px-5 py-2 text-sm text-white/70">
                Revealing…
              </div>
            ) : !room.revealed ? (
              <>
                {canControl ? (
                  <button
                    onClick={onReveal}
                    disabled={stats.votedCount === 0}
                    className="rounded-full bg-gold px-7 py-2.5 text-base font-extrabold text-black shadow-lg transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reveal cards
                  </button>
                ) : (
                  <div className="rounded-full bg-black/25 px-5 py-2 text-sm text-white/70">
                    Waiting for the facilitator…
                  </div>
                )}
                <div className="text-xs text-white/70">
                  {stats.votedCount} / {stats.totalPlayers} voted
                </div>
              </>
            ) : (
              <>
                <div className="flex items-end gap-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-white/60">Average</div>
                    <div className="text-3xl font-extrabold text-gold">{stats.average ?? "—"}</div>
                  </div>
                  <div className="flex gap-1.5 pb-1">
                    {stats.distribution.map(([value, n]) => (
                      <div key={value} className="rounded bg-black/40 px-2 py-1 text-center">
                        <div className="text-sm font-bold">{value}</div>
                        <div className="text-[10px] text-white/60">×{n}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {stats.consensus && (
                  <div className="text-sm font-bold text-emerald-300">🎉 Consensus!</div>
                )}
                {canControl && (
                  <button
                    onClick={onReset}
                    className="rounded-full bg-white/90 px-6 py-2 text-sm font-bold text-black shadow transition hover:bg-white active:scale-95"
                  >
                    New round
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cards on the felt */}
      {ordered.map((p, i) =>
        p.role === "spectator" ? null : (
          <div
            key={`c-${p.id}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos[i].card.x}%`, top: `${pos[i].card.y}%` }}
          >
            <PlayingCard value={p.vote} revealed={showResults} hasVoted={p.hasVoted} />
          </div>
        )
      )}

      {/* Seats */}
      {ordered.map((p, i) => (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos[i].seat.x}%`, top: `${pos[i].seat.y}%` }}
        >
          <Seat player={p} isMe={p.id === meId} />
        </div>
      ))}
    </div>
  );
}
