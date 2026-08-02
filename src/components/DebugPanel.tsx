"use client";

import type { Player } from "@/lib/types";

interface Props {
  meId: string;
  connected: boolean;
  revealed: boolean;
  showResults: boolean;
  myVote: string | null;
  canControl: boolean;
  facilitatorId: string;
  players: Player[];
  dbError?: string | null;
}

/**
 * Opt-in diagnostics for the realtime bugs. Add ?debug to the room URL on every
 * client, reproduce the reveal, and screenshot each one: the panel shows exactly
 * what that client sees, so the failure is obvious - a player missing here but
 * not there (presence drop), a vote stuck at null after reveal (the value didn't
 * arrive), or revealed/showResults out of step (the round didn't converge).
 * Invisible unless ?debug is set, so it's safe to ship.
 */
export default function DebugPanel({
  meId,
  connected,
  revealed,
  showResults,
  myVote,
  canControl,
  facilitatorId,
  players,
  dbError,
}: Props) {
  const short = (id: string) => id.slice(0, 4);
  return (
    <div className="pointer-events-none fixed left-2 top-16 z-50 max-w-[92vw] rounded-lg border border-white/20 bg-black/85 p-2 font-mono text-[10px] leading-tight text-white/90 shadow-xl sm:text-[11px]">
      <div className="mb-1 font-bold text-emerald-300">DEBUG</div>
      {dbError && (
        <div className="mb-1 rounded bg-red-600/80 px-1 py-0.5 font-bold text-white">
          DB ERROR: {dbError}
        </div>
      )}
      <div>
        conn=<b className={connected ? "text-emerald-400" : "text-red-400"}>{String(connected)}</b>{" "}
        revealed=<b>{String(revealed)}</b> showResults=<b>{String(showResults)}</b>
      </div>
      <div>
        me=<b>{short(meId)}</b> myVote=<b>{myVote ?? "—"}</b> canControl=<b>{String(canControl)}</b>{" "}
        facil=<b>{short(facilitatorId)}</b> players=<b>{players.length}</b>
      </div>
      <table className="mt-1 w-full border-collapse">
        <thead>
          <tr className="text-white/50">
            <th className="pr-2 text-left">id</th>
            <th className="pr-2 text-left">name</th>
            <th className="pr-2 text-left">role</th>
            <th className="pr-2 text-left">voted</th>
            <th className="text-left">vote</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className={p.id === meId ? "text-gold" : ""}>
              <td className="pr-2">{short(p.id)}</td>
              <td className="pr-2">{p.name}</td>
              <td className="pr-2">{p.role === "spectator" ? "spec" : "play"}</td>
              <td className="pr-2">{p.hasVoted ? "yes" : "—"}</td>
              <td>{p.vote ?? "·"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
