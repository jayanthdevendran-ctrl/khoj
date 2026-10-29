"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/** Public image URL for an uploaded floorplan on this floor, or null if none uploaded yet. */
export function useFloorplan(floor: number) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from("floorplans")
      .select("image_url")
      .eq("floor", floor)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.image_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [floor]);

  return url;
}
