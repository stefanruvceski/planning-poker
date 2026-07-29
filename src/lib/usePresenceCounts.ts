"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * How many people are sitting at each of the given rooms, for the lobby.
 *
 * The trick is that this subscribes to each room channel but never calls
 * `track()`, so the observer does not show up as a phantom occupant - it only
 * reads the presences the real players published. One key is one person, so the
 * count is the number of distinct presence keys.
 */
export function usePresenceCounts(roomIds: readonly string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  // A stable key so the effect re-runs only when the set of rooms actually changes.
  const key = roomIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    const channels = ids.map((id) => {
      const ch = supabase.channel(`room:${id}`, {
        // No presence key of our own: we watch, we do not take a seat.
        config: { presence: {} },
      });
      ch.on("presence", { event: "sync" }, () => {
        const heads = Object.keys(ch.presenceState()).length;
        setCounts((prev) => (prev[id] === heads ? prev : { ...prev, [id]: heads }));
      });
      ch.subscribe();
      return ch;
    });

    return () => {
      channels.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [key]);

  return counts;
}
