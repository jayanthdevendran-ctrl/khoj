"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Admin-only. Uploads a floor plan image to the `floorplans` Supabase Storage
 * bucket and points the `floorplans` table row for this floor at it.
 */
export default function FloorplanUploader({ floor, label, onDone }: { floor: number; label?: string; onDone?: () => void | Promise<void> }) {
  label = label ?? `Floor ${floor}`;
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from("floorplans")
      .select("image_url")
      .eq("floor", floor)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCurrentUrl(data?.image_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [floor]);

  async function handleUpload() {
    if (!file) return;
    if (!isSupabaseConfigured) {
      setStatus("error");
      setMessage("Supabase isn't configured yet — set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY first.");
      return;
    }
    setStatus("uploading");
    setMessage(null);

    const ext = file.name.split(".").pop();
    const path = `floor-${floor}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("floorplans").upload(path, file, { upsert: true, cacheControl: "60" });
    if (uploadError) {
      setStatus("error");
      setMessage(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("floorplans").getPublicUrl(path);
    const imageUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: dbError } = await supabase.from("floorplans").upsert({ floor, image_url: imageUrl, updated_at: new Date().toISOString() });
    if (dbError) {
      setStatus("error");
      setMessage(dbError.message);
      return;
    }

    setCurrentUrl(imageUrl);
    setFile(null);
    setStatus("done");
    setMessage("Uploaded. It’s now live on the Explore map.");
    await onDone?.();
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/50 dark:text-paper/50">{label}</p>
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt={`${label} plan`} className="mb-3 w-full rounded-lg border border-line object-contain dark:border-white/10" />
      ) : (
        <p className="mb-3 rounded-lg bg-mist px-3 py-6 text-center text-xs text-ink/50 dark:bg-white/5 dark:text-paper/50">No floor plan uploaded yet</p>
      )}
      <input
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-3 block w-full text-sm"
      />
      <button
        onClick={handleUpload}
        disabled={!file || status === "uploading"}
        className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {status === "uploading" ? "Uploading..." : currentUrl ? "Replace floor plan" : "Upload floor plan"}
      </button>
      {message && <p className={`mt-2 text-sm ${status === "error" ? "text-coral" : "text-teal"}`}>{message}</p>}
    </div>
  );
}
