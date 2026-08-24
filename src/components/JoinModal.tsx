"use client";

import { useEffect, useState } from "react";
import { avatarUrl, randomSeed } from "@/config/avatars";
import type { PlayerRole } from "@/lib/types";

interface Props {
  roomName: string;
  /** Prefill from the signed-in profile so the name/avatar carry across rooms. */
  initialName?: string;
  initialAvatarSeed?: string;
  onJoin: (data: { name: string; role: PlayerRole; avatarSeed: string }) => void;
}

export default function JoinModal({ roomName, initialName = "", initialAvatarSeed = "", onJoin }: Props) {
  const [name, setName] = useState(initialName);
  const [spectator, setSpectator] = useState(false);
  // Seed is generated on the client only - otherwise SSR and client render
  // different avatars and React reports a hydration mismatch.
  const [seed, setSeed] = useState(initialAvatarSeed);
  useEffect(() => {
    if (!initialAvatarSeed) setSeed(randomSeed());
  }, [initialAvatarSeed]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin({ name: name.trim(), role: spectator ? "spectator" : "player", avatarSeed: seed });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-[92vw] max-w-[360px] rounded-2xl border border-white/10 bg-gradient-to-b from-[#252b38] to-[#151922] p-6 shadow-2xl"
      >
        <h2 className="text-center text-xl font-extrabold">Take a seat</h2>
        <p className="mt-1 text-center text-xs text-white/50">{roomName}</p>

        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="chip-ring h-20 w-20 overflow-hidden rounded-full bg-black/30">
            {seed && <img src={avatarUrl(seed)} alt="avatar" className="h-full w-full" />}
          </div>
          <button
            type="button"
            onClick={() => setSeed(randomSeed())}
            className="text-xs text-white/60 underline hover:text-white"
          >
            shuffle avatar 🎲
          </button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          className="mt-5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-center outline-none focus:border-gold"
        />

        <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg bg-black/30 px-3 py-2.5">
          <span className="text-sm">
            Join as spectator
            <span className="block text-[11px] text-white/45">watch only, no voting (e.g. PM)</span>
          </span>
          <span
            onClick={() => setSpectator((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${spectator ? "bg-emerald-500" : "bg-slate-600"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                spectator ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
        </label>

        <button
          type="submit"
          disabled={!name.trim()}
          className="mt-5 w-full rounded-lg bg-gold py-3 font-extrabold text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          Join table
        </button>
      </form>
    </div>
  );
}
