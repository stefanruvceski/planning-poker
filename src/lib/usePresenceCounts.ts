"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** A seat counts as "here" if it heartbeat within this window (matches useRoom). */
const FRESH_MS = 40_000;

/**
 * How many people are currently sitting at each room of a brand, for the lobby
 * head counts. Reads the participants table (RLS scopes it to the caller's
 * brand) and counts seats with a recent heartbeat, keyed by full room id. Polled
 * on a short interval - the lobby is not a hot path.
 */
export function useRoomCounts(brandId: string | undefined): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!brandId) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("participants")
        .select("room_id, last_seen")
        .eq("brand_id", brandId);
      if (!active || !data) return;
      const cutoff = Date.now() - FRESH_MS;
      const next: Record<string, number> = {};
      for (const row of data as { room_id: string; last_seen: string }[]) {
        if (Date.parse(row.last_seen) >= cutoff) next[row.room_id] = (next[row.room_id] ?? 0) + 1;
      }
      setCounts(next);
    };

    void load();
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [brandId]);

  return counts;
}
