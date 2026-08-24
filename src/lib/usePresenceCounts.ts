"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * How many people are currently sitting at each room of the caller's brand, for
 * the lobby head counts. Counted in the DATABASE (server clock) via the
 * room_head_counts() RPC - judging freshness against this browser's clock had
 * the same skew problem that dropped live players in a room. Polled lightly.
 */
export function useRoomCounts(brandId: string | undefined): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!brandId) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase.rpc("room_head_counts");
      if (!active || !data) return;
      const next: Record<string, number> = {};
      for (const row of data as { room_id: string; n: number }[]) next[row.room_id] = row.n;
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
