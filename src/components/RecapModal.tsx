"use client";

import { useState } from "react";
import type { RecapEntry } from "@/lib/useRoom";

interface Props {
  roomName: string;
  entries: RecapEntry[];
  onClose: () => void;
  onClear: () => void;
}

/** "3×5d, 1×8d" - the same breakdown the table shows, on one line. */
const votesLine = (distribution: [string, number][]) =>
  distribution.map(([value, n]) => `${n}×${value}`).join(", ");

/** The recap as Markdown, ready to paste into a ticket or a doc. */
function toMarkdown(roomName: string, entries: RecapEntry[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const head = `# ${roomName} — estimation recap\n\n_${entries.length} ${
    entries.length === 1 ? "story" : "stories"
  } · ${date}_\n`;
  const table = [
    "| # | Story | Estimate | Votes | Consensus |",
    "|---|-------|----------|-------|-----------|",
    ...entries.map(
      (e, i) =>
        `| ${i + 1} | ${e.story.trim() || "_(untitled)_"} | ${e.estimate} | ${votesLine(
          e.distribution
        )} | ${e.consensus ? "✓" : ""} |`
    ),
  ].join("\n");
  return `${head}\n${table}\n`;
}

/** End-of-session overview of every story estimated, with copy / download. */
export default function RecapModal({ roomName, entries, onClose, onClear }: Props) {
  const [copied, setCopied] = useState(false);
  const markdown = toMarkdown(roomName, entries);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const field = document.createElement("textarea");
        field.value = markdown;
        field.style.cssText = "position:fixed;top:0;opacity:0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the recap:", markdown);
    }
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recap-${roomName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#252b38] to-[#151922] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold">Session recap</h2>
            <p className="text-xs text-white/45">
              {entries.length} {entries.length === 1 ? "story" : "stories"} estimated
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-white/50 hover:text-white">
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              Nothing yet — reveal a round and it lands here.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {entries.map((e, i) => (
                <li
                  key={e.rev}
                  className="flex items-center justify-between gap-3 rounded-lg bg-black/30 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-xs text-white/35">{i + 1}</span>
                    <span className="truncate text-sm">
                      {e.story.trim() || <span className="text-white/40">untitled</span>}
                    </span>
                    {e.consensus && <span title="Consensus">🎉</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-[11px] text-white/40 sm:inline">{votesLine(e.distribution)}</span>
                    <span className="rounded bg-gold/20 px-2 py-0.5 text-sm font-bold text-gold">{e.estimate}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
          <button
            onClick={onClear}
            disabled={entries.length === 0}
            className="text-xs text-white/40 underline transition hover:text-red-300 disabled:opacity-40"
          >
            clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={download}
              disabled={entries.length === 0}
              className="rounded-lg bg-black/40 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-black/60 disabled:opacity-40"
            >
              Download .md
            </button>
            <button
              onClick={copy}
              disabled={entries.length === 0}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-extrabold text-black transition hover:brightness-110 disabled:opacity-40"
            >
              {copied ? "Copied ✓" : "Copy Markdown"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
