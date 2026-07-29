"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import LogoMark from "@/components/LogoMark";
import { slugifyRoom, TEAM_ROOMS } from "@/config/room";

/**
 * Lobby. Landing here instead of dumping everyone into /room/default: the team
 * tables are listed by name, and anyone can spin up a one-off table by typing a
 * name. The slug is the whole room - no state to create server-side.
 */
export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");

  const slug = slugifyRoom(name);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    router.push(`/room/${slug}`);
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
                <span className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-gold">
                  &rarr;
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
          {slug && (
            <p className="text-center text-[11px] text-white/35">
              opens <span className="text-white/60">/room/{slug}</span>
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
