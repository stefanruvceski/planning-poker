"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { DECK_LIST, getDeck } from "@/config/decks";
import { computeStats } from "@/lib/stats";
import type { Player, RoomState } from "@/lib/types";
import ChipStack, { chipTone } from "./ChipStack";
import FeltEmblem from "./FeltEmblem";
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
  /** Whose seat carries the dealer button. */
  facilitatorId: string;
  /** Who takes this round's pot. */
  winnerIds: string[];
  onReveal: () => void;
  onReset: () => void;
  onStory: (text: string) => void;
  /** Facilitator switches the deck; every table converges on it. */
  onDeck: (deckId: string) => void;
  /** When the voting timer fires (epoch ms), or null for none. */
  deadline: number | null;
  /** Facilitator starts a countdown of this many seconds. */
  onStartTimer: (seconds: number) => void;
  /** Facilitator stops a running countdown without revealing. */
  onCancelTimer: () => void;
}

/** Facilitator-only deck switch, shown before the reveal. */
function DeckPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-xs text-white/75">
      <span className="uppercase tracking-wide text-white/50">Deck</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-md border border-white/15 bg-[#1b202b] px-2 py-0.5 font-semibold text-white outline-none focus:border-gold"
      >
        {DECK_LIST.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const TIMER_PRESETS = [30, 60, 120];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Live countdown to the deadline - everyone sees the same one. Urgent under 10s. */
function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = left <= 10;
  return (
    <div
      className={`table-label flex items-center gap-1.5 rounded-full px-4 py-1 text-sm font-extrabold tabular-nums sm:text-base ${
        urgent ? "animate-pulse bg-red-600/80 text-white" : "bg-black/40 text-gold"
      }`}
    >
      ⏱ {fmt(left)}
    </div>
  );
}

/** Facilitator-only presets to start the voting timer. */
function TimerPresets({ onStart }: { onStart: (seconds: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-white/60">
      <span className="uppercase tracking-wide text-white/40">Timer</span>
      {TIMER_PRESETS.map((s) => (
        <button
          key={s}
          onClick={() => onStart(s)}
          className="rounded-full bg-black/35 px-2.5 py-0.5 font-semibold text-white/80 transition hover:bg-black/55 hover:text-white"
        >
          {fmt(s)}
        </button>
      ))}
    </div>
  );
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

/** Which winner's seat a given stack is pushed to; ties share the stacks out. */
function payoutSeat(
  ordered: Player[],
  pos: ReturnType<typeof seatPositions>,
  winnerIds: string[],
  i: number
) {
  if (!winnerIds.length) return null;
  const idx = ordered.findIndex((p) => p.id === winnerIds[i % winnerIds.length]);
  return idx < 0 ? null : pos[idx].seat;
}

/** Cards flip, then the bets are gathered, then the pot is pushed to the winner. */
const GATHER_AFTER_MS = 450;
const PAY_AFTER_MS = 1500;

export default function PokerTable({
  room,
  meId,
  canControl,
  showResults,
  facilitatorId,
  winnerIds,
  onReveal,
  onReset,
  onStory,
  onDeck,
  deadline,
  onStartTimer,
  onCancelTimer,
}: Props) {
  const deck = getDeck(room.deckId);
  const stats = computeStats(room.players, deck);
  // Everyone who can vote has - the cue for the facilitator to reveal.
  const allVoted = stats.totalPlayers > 0 && stats.votedCount === stats.totalPlayers;

  const meIndex = room.players.findIndex((p) => p.id === meId);
  const ordered = meIndex > 0 ? [...room.players.slice(meIndex), ...room.players.slice(0, meIndex)] : room.players;
  const pos = seatPositions(ordered.length);

  // Nobody wears the crown while the whole table is still on zero.
  const topChips = Math.max(0, ...ordered.map((p) => p.chips));
  const leaderIds = topChips > 0 ? ordered.filter((p) => p.chips === topChips).map((p) => p.id) : [];

  const [phase, setPhase] = useState<"bet" | "pot" | "payout">("bet");

  useEffect(() => {
    if (!showResults) {
      setPhase("bet");
      return;
    }
    const gather = setTimeout(() => setPhase("pot"), GATHER_AFTER_MS);
    const pay = setTimeout(() => setPhase("payout"), PAY_AFTER_MS);
    return () => {
      clearTimeout(gather);
      clearTimeout(pay);
    };
  }, [showResults]);

  return (
    <div className="relative aspect-[16/8.5] h-full w-auto max-h-full max-w-full">
      {/* Rail + felt: stadium shape, like a real poker table */}
      <div className="rail absolute inset-x-[7%] inset-y-[14%] rounded-full p-3">
        <div className="felt relative flex h-full w-full items-center justify-center rounded-full">
          <FeltEmblem />

          {/* Table centre */}
          <div className="relative flex flex-col items-center gap-1.5 text-center sm:gap-2">
            <StoryBar story={room.story ?? ""} editable={canControl} onChange={onStory} />

            {room.revealed && !showResults ? (
              <div className="table-label rounded-full bg-black/30 px-4 py-1.5 text-xs text-white/75 sm:px-5 sm:py-2 sm:text-sm">
                Revealing…
              </div>
            ) : !room.revealed ? (
              <>
                {deadline !== null && <Countdown deadline={deadline} />}
                {canControl ? (
                  <>
                    <DeckPicker value={room.deckId} onChange={onDeck} />
                    {deadline === null ? (
                      <TimerPresets onStart={onStartTimer} />
                    ) : (
                      <button
                        onClick={onCancelTimer}
                        className="text-xs text-white/50 underline transition hover:text-white"
                      >
                        cancel timer
                      </button>
                    )}
                    <button
                      onClick={onReveal}
                      disabled={stats.votedCount === 0}
                      className={`btn-gloss btn-gold rounded-full px-5 py-2 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40 sm:px-7 sm:py-2.5 sm:text-base ${
                        allVoted ? "reveal-ready" : ""
                      }`}
                    >
                      Reveal cards
                    </button>
                  </>
                ) : (
                  <div className="table-label rounded-full bg-black/30 px-4 py-1.5 text-xs text-white/75 sm:px-5 sm:py-2 sm:text-sm">
                    Waiting for the facilitator…
                  </div>
                )}
                <div
                  className={`table-label text-xs ${
                    allVoted ? "font-bold text-emerald-300" : "text-white/75"
                  }`}
                >
                  {stats.votedCount} / {stats.totalPlayers} voted
                  {allVoted && " — all in!"}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-end gap-3 sm:gap-6">
                  <div>
                    <div className="table-label text-[10px] uppercase tracking-wide text-white/60 sm:text-[11px]">
                      Average
                    </div>
                    <div className="table-label text-2xl font-extrabold text-gold sm:text-3xl">
                      {stats.average !== null ? `${stats.average}${deck.suffix ?? ""}` : "—"}
                    </div>
                  </div>
                  <div className="flex max-w-[45vw] flex-wrap justify-center gap-1.5 pb-1 sm:max-w-none sm:flex-nowrap">
                    {stats.distribution.map(([value, n]) => (
                      <div
                        key={value}
                        className="rounded bg-black/45 px-2 py-1 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.12)]"
                      >
                        <div className="text-sm font-bold">{value}</div>
                        <div className="text-[10px] text-white/60">×{n}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {stats.consensus && (
                  <div className="table-label text-sm font-bold text-emerald-300">🎉 Consensus!</div>
                )}
                {canControl && (
                  <button
                    onClick={onReset}
                    className="btn-gloss btn-cream rounded-full px-5 py-1.5 text-xs font-bold sm:px-6 sm:py-2 sm:text-sm"
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

      {/* The bets. Own layer, so a stack can travel from its card to the pot and
          on to the winner in one coordinate space. */}
      <AnimatePresence>
        {ordered.map((p, i) => {
          if (p.role === "spectator" || !p.hasVoted) return null;

          const winnerSeat = payoutSeat(ordered, pos, winnerIds, i);
          const at =
            phase === "bet" || !winnerSeat
              ? { x: pos[i].card.x - 5, y: pos[i].card.y + 2 }
              : phase === "pot"
                ? { x: 50 + ((i % 3) - 1) * 2.5, y: 66 + ((i % 2) - 0.5) * 3 }
                : winnerSeat;

          return (
            <ChipStack
              key={`chips-${p.id}`}
              tone={showResults ? chipTone(deck, p.vote) : "chip-hidden"}
              at={at}
              jitter={(p.id.charCodeAt(0) % 3) - 1}
              faded={phase === "payout"}
            />
          );
        })}
      </AnimatePresence>

      {/* Seats */}
      {ordered.map((p, i) => (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos[i].seat.x}%`, top: `${pos[i].seat.y}%` }}
        >
          <Seat
            player={p}
            isMe={p.id === meId}
            isDealer={p.id === facilitatorId}
            showResults={showResults}
            isLeader={leaderIds.includes(p.id)}
            wonRound={phase === "payout" && winnerIds.includes(p.id)}
          />
        </div>
      ))}
    </div>
  );
}
