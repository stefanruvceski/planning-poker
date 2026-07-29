"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LogoMark from "./LogoMark";

interface Props {
  roomName: string;
  deckName: string;
  playerCount: number;
  connected: boolean;
}

export default function TopBar({ roomName, deckName, playerCount, connected }: Props) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  /** Copy the current room URL - that link is the whole invite. */
  const invite = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // navigator.clipboard only exists in secure contexts, so a plain-http
        // preview would otherwise get a button that does nothing.
        const field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.cssText = "position:fixed;top:0;opacity:0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // The browser can still refuse (permission, unfocused document). Show the
      // link rather than failing silently, which is what it did before.
      window.prompt("Copy the room link:", url);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-black/60 bg-gradient-to-b from-[#2b3140] to-[#171b24] px-4 shadow-lg">
      <Link href="/" className="flex items-center gap-3 transition hover:opacity-80" title="Back to lobby">
        <LogoMark className="h-7 w-7 shrink-0 text-[#e9453c]" />
        <div className="leading-none">
          <span className="text-xl font-extrabold tracking-tight text-red-500">planning</span>
          <span className="text-xl font-extrabold tracking-tight text-white">poker</span>
        </div>
      </Link>

      <div className="hidden items-center gap-4 text-sm text-white/70 sm:flex">
        <span className="font-semibold text-white">{roomName}</span>
        <span className="rounded bg-black/40 px-2 py-0.5">Deck: {deckName}</span>
        <span className="rounded bg-black/40 px-2 py-0.5">👥 {playerCount}</span>
        <span className="flex items-center gap-1.5" title={connected ? "Connected" : "Connecting…"}>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "animate-pulse bg-amber-400"}`} />
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      <button
        onClick={invite}
        aria-live="polite"
        className={`min-w-[104px] rounded-md px-3 py-1.5 text-sm font-bold shadow transition active:scale-95 ${
          copied ? "bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {copied ? "Link copied ✓" : "Invite team"}
      </button>
    </header>
  );
}
