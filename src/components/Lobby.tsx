"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import LogoMark from "@/components/LogoMark";
import { DECK_LIST, DEFAULT_DECK_ID } from "@/config/decks";
import { roomLabel, slugifyRoom, TEAM_ROOMS } from "@/config/room";
import { readLastRoom } from "@/lib/lastRoom";
import { usePresenceCounts } from "@/lib/usePresenceCounts";

const TEAM_IDS = TEAM_ROOMS.map((room) => room.id);

/** Live "who's here" badge - only shown once someone is actually at the table. */
function HereBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      {count} here
    </span>
  );
}

/**
 * Lobby. Landing here instead of dumping everyone into /room/default: the team
 * tables are listed by name with a live head count, there's a one-click way
 * back to the last table you sat at, and anyone can spin up a one-off table by
 * typing a name. The slug is the whole room - no state to create server-side.
 */
export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [deckId, setDeckId] = useState(DEFAULT_DECK_ID);
  const counts = usePresenceCounts(TEAM_IDS);

  // localStorage is only there on the client, so read it after mount to keep
  // the server and first client render identical.
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  useEffect(() => setLastRoom(readLastRoom()), []);

  const slug = slugifyRoom(name);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    // The deck rides along in the URL so the invite link carries it too; the
    // default deck is left off to keep the common link clean.
    const query = deckId !== DEFAULT_DECK_ID ? `?deck=${deckId}` : "";
    router.push(`/room/${slug}${query}`);
  };

  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-y-auto px-4 py-12">
      <header className="mb-10 flex flex-col items-center gap-3 text-center">
        <LogoMark className="h-14 w-14 text-[#e9453c]" />
        <h1 className="text-3xl font-extrabold leading-none tracking-tight">
          <span className="text-red-500">planning</span>
          <span className="text-white">poker</span>
        </h1>
        <p className="text-sm text-white/50">Pick your team&rsquo;s table, or open a new one.</p>
      </header>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#252b38] to-[#151922] p-6 shadow-2xl">
        {lastRoom && (
          <Link
            href={`/room/${lastRoom}`}
            className="mb-5 flex items-center justify-between rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 transition hover:bg-gold/20"
          >
            <span className="flex flex-col leading-tight">
              <span className="text-[11px] uppercase tracking-wider text-gold/70">Jump back in</span>
              <span className="font-semibold text-gold">{roomLabel(lastRoom)}</span>
            </span>
            <span className="flex items-center gap-3">
              <HereBadge count={counts[lastRoom] ?? 0} />
              <span className="text-gold/70">&rarr;</span>
            </span>
          </Link>
        )}

        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Team tables</h2>
        <ul className="flex flex-col gap-2">
          {TEAM_ROOMS.map((room) => (
            <li key={room.id}>
              <Link
                href={`/room/${room.id}`}
                className="group flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-4 py-3 transition hover:border-gold/60 hover:bg-black/50"
              >
                <span className="flex items-center gap-3">
                  <span className="chip chip-hidden h-6 w-6 shrink-0" aria-hidden="true" />
                  <span className="font-semibold">{room.label}</span>
                </span>
                <span className="flex items-center gap-3">
                  <HereBadge count={counts[room.id] ?? 0} />
                  <span className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-gold">
                    &rarr;
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/25">
          <span className="h-px flex-1 bg-white/10" />
          or start a new one
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={create} className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New table name"
            maxLength={40}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-center outline-none focus:border-gold"
          />
          <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm">
            <span className="text-white/60">Deck</span>
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="cursor-pointer rounded-md border border-white/10 bg-[#1b202b] px-2 py-1 font-semibold text-white outline-none focus:border-gold"
            >
              {DECK_LIST.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </label>
          {slug && (
            <p className="text-center text-[11px] text-white/35">
              opens{" "}
              <span className="text-white/60">
                /room/{slug}
                {deckId !== DEFAULT_DECK_ID && `?deck=${deckId}`}
              </span>
            </p>
          )}
          <button
            type="submit"
            disabled={!slug}
            className="w-full rounded-lg bg-gold py-3 font-extrabold text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            Create table
          </button>
        </form>
      </div>
    </main>
  );
}
