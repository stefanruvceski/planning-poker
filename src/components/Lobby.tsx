"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import { DECK_LIST, DEFAULT_DECK_ID } from "@/config/decks";
import { makeRoomId, roomLabel, slugifyRoom } from "@/config/room";
import { readLastRoom } from "@/lib/lastRoom";
import { useTenant } from "@/lib/tenant";
import { useRoomCounts } from "@/lib/usePresenceCounts";

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
 * The brand's lobby. The team list, the name and the logo all come from the
 * `brands` row for the logged-in user - nothing here is hardcoded per company.
 * Every table link is brand-qualified so two brands never share a room.
 */
export default function Lobby() {
  const router = useRouter();
  const { brand, profile, signOut } = useTenant();
  const [name, setName] = useState("");
  const [deckId, setDeckId] = useState(DEFAULT_DECK_ID);
  const counts = useRoomCounts(brand.id);

  // Team name -> { id (full room id), label }.
  const teams = useMemo(
    () => brand.teams.map((team) => ({ id: makeRoomId(brand.id, slugifyRoom(team)), label: team })),
    [brand.id, brand.teams]
  );

  const [lastRoom, setLastRoom] = useState<string | null>(null);
  useEffect(() => {
    const last = readLastRoom();
    // Only offer a jump-back to a table of THIS brand.
    setLastRoom(last && last.startsWith(`${brand.id}__`) ? last : null);
  }, [brand.id]);

  const slug = slugifyRoom(name);
  const deckQuery = deckId !== DEFAULT_DECK_ID ? `?deck=${deckId}` : "";
  const withDeck = (path: string) => `${path}${deckQuery}`;
  const roomHref = (roomId: string) => withDeck(`/room/${roomId}`);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    router.push(roomHref(makeRoomId(brand.id, slug)));
  };

  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center overflow-y-auto px-4 py-12">
      <header className="mb-10 flex flex-col items-center gap-3 text-center">
        <BrandLogo brand={brand} className="h-14 w-14" />
        <h1 className="text-3xl font-extrabold leading-none tracking-tight text-white">{brand.name}</h1>
        <p className="text-sm text-white/50">Pick your team&rsquo;s table, or open a new one.</p>
      </header>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-[#252b38] to-[#151922] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between text-xs text-white/40">
          <span>
            Signed in as <span className="text-white/70">{profile.display_name}</span>
          </span>
          <button onClick={signOut} className="underline transition hover:text-white">
            sign out
          </button>
        </div>

        <div className="mb-5 rounded-lg border border-white/10 bg-black/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white/70">Deck</span>
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="cursor-pointer rounded-md border border-white/10 bg-[#1b202b] px-2 py-1 text-sm font-semibold text-white outline-none focus:border-gold"
            >
              {DECK_LIST.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-[11px] text-white/35">Applies to whichever table you open below.</p>
        </div>

        {lastRoom && (
          <Link
            href={roomHref(lastRoom)}
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
        {teams.length === 0 ? (
          <p className="rounded-lg border border-white/5 bg-black/30 px-4 py-3 text-sm text-white/45">
            No teams set up for {brand.name} yet — start one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={roomHref(team.id)}
                  className="group flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-4 py-3 transition hover:border-gold/60 hover:bg-black/50"
                >
                  <span className="flex items-center gap-3">
                    <span className="chip chip-hidden h-6 w-6 shrink-0" aria-hidden="true" />
                    <span className="font-semibold">{team.label}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <HereBadge count={counts[team.id] ?? 0} />
                    <span className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-gold">
                      &rarr;
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

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
          {slug && (
            <p className="text-center text-[11px] text-white/35">
              opens <span className="text-white/60">/room/{makeRoomId(brand.id, slug)}</span>
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
