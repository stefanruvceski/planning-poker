"use client";

interface Props {
  roomName: string;
  deckName: string;
  playerCount: number;
  connected: boolean;
}

export default function TopBar({ roomName, deckName, playerCount, connected }: Props) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-black/60 bg-gradient-to-b from-[#2b3140] to-[#171b24] px-4 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🃏</span>
        <div className="leading-none">
          <span className="text-xl font-extrabold tracking-tight text-red-500">planning</span>
          <span className="text-xl font-extrabold tracking-tight text-white">poker</span>
        </div>
      </div>

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
        onClick={() => navigator.clipboard?.writeText(window.location.href)}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-bold shadow transition hover:bg-emerald-500 active:scale-95"
      >
        Invite team
      </button>
    </header>
  );
}
