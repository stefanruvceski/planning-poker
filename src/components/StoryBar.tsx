"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  story: string;
  editable: boolean;
  onChange: (text: string) => void;
}

/**
 * The story being estimated. Only the facilitator sees an input; everyone else
 * sees the text, and nothing at all while it is empty.
 */
export default function StoryBar({ story, editable, onChange }: Props) {
  const [draft, setDraft] = useState(story);
  const focused = useRef(false);

  // Adopt remote edits, but never yank the text out from under someone typing.
  useEffect(() => {
    if (!focused.current) setDraft(story);
  }, [story]);

  // Debounced: typing shouldn't put a message on the wire per keystroke.
  useEffect(() => {
    if (!editable || draft === story) return;
    const t = setTimeout(() => onChange(draft), 400);
    return () => clearTimeout(t);
  }, [draft, story, editable, onChange]);

  if (!editable) {
    if (!story.trim()) return null;
    return (
      <div className="max-w-[70vw] truncate rounded-full bg-black/35 px-4 py-1 text-xs text-white/85 sm:max-w-md sm:text-sm">
        {story}
      </div>
    );
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        if (draft !== story) onChange(draft);
      }}
      maxLength={80}
      placeholder="What are we estimating? (optional)"
      className="w-52 rounded-full border border-white/15 bg-black/35 px-4 py-1.5 text-center text-xs text-white outline-none transition placeholder:text-white/40 focus:border-gold focus:bg-black/50 sm:w-80 sm:text-sm"
    />
  );
}
