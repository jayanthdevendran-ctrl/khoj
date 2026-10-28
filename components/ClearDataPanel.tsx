"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ScopeId = "awards" | "projects" | "rooms" | "floorplans" | "subjects" | "emails";

const OPTIONS: { id: ScopeId; label: string; desc: string }[] = [
  { id: "awards", label: "Awards, rankings & passports (every account)", desc: "Every rating and badge for every student account. Resets the People’s Choice and Explorer standings, each student’s passport and ratings, and the admin award standings." },
  { id: "projects", label: "Projects, teams & logos", desc: "Every project, its team and members, and the uploaded logo images. Awards are cleared too, because they belong to projects." },
  { id: "rooms", label: "Rooms & map markers", desc: "All rooms and the restroom / staircase / amenity markers. Projects are kept but lose their room." },
  { id: "floorplans", label: "Floor plan images", desc: "The uploaded floor plan for every floor." },
  { id: "subjects", label: "Subjects / categories", desc: "The subject list used to group and filter projects." },
  { id: "emails", label: "Approved student email list", desc: "Students on the list can no longer create new accounts. Existing accounts are not deleted." },
];

const COUNT_LABELS: Record<string, string> = {
  ratings: "ratings", badges: "badges", visitors: "visitors", projects: "projects", teams: "teams",
  markers: "map markers", rooms: "rooms", subjects: "subjects", floorplans: "floor plans", emails: "approved emails",
};

/** Lists every file under a storage folder ("" = bucket root) so it can be removed. */
async function listFiles(folder: string): Promise<string[]> {
  const found: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from("floorplans").list(folder, { limit: 100, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) if (item.id) found.push(folder ? `${folder}/${item.name}` : item.name);
    if (data.length < 100) break;
  }
  return found;
}

async function removeFiles(paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from("floorplans").remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

export default function ClearDataPanel({ onCleared }: { onCleared?: () => void | Promise<void> }) {
  const [selected, setSelected] = useState<Set<ScopeId>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const forcedAwards = selected.has("projects");
  const effective = new Set(selected);
  if (forcedAwards) effective.add("awards");
  const allSelected = OPTIONS.every((o) => effective.has(o.id));
  const canRun = effective.size > 0 && confirmText.trim().toUpperCase() === "CLEAR" && !busy;

  function toggle(id: ScopeId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run() {
    setBusy(true);
    setResult(null);
    const scopes = Array.from(effective);
    try {
      const { data, error } = await supabase.rpc("clear_khoj_data", { p_scopes: scopes });
      if (error) {
        const missing = /schema cache|could not find the function/i.test(error.message);
        throw new Error(missing ? `The database can’t see the clear-records function yet. In the Supabase SQL editor run: notify pgrst, 'reload schema'; — and if that doesn’t help, re-run supabase/v4_migration.sql. (Details: ${error.message})` : error.message);
      }

      // Uploaded image files live in storage, not in the tables.
      let fileNote = "";
      try {
        const paths: string[] = [];
        if (effective.has("projects")) paths.push(...(await listFiles("logos")));
        if (effective.has("floorplans")) paths.push(...(await listFiles("")).filter((p) => p.startsWith("floor-")));
        if (paths.length) await removeFiles(paths);
      } catch (e) {
        fileNote = ` Records were cleared, but some image files could not be removed (${e instanceof Error ? e.message : "storage error"}); run supabase/v4_migration.sql if you haven’t.`;
      }

      const counts = Object.entries((data ?? {}) as Record<string, number>)
        .filter(([, n]) => Number(n) > 0)
        .map(([k, n]) => `${n} ${COUNT_LABELS[k] ?? k}`);
      setResult({ kind: "ok", text: `${counts.length ? `Cleared: ${counts.join(", ")}.` : "Nothing needed clearing — those records were already empty."}${fileNote}` });
      setSelected(new Set());
      setConfirmText("");
      await onCleared?.();
    } catch (e) {
      setResult({ kind: "error", text: e instanceof Error ? e.message : "Could not clear records." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl2 border border-coral/40 p-4">
      <h2 className="font-display text-lg font-semibold text-coral">5. Clear records</h2>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Permanently delete event data — for example to wipe test entries before the event. This cannot be undone.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(OPTIONS.map((o) => o.id)))}
          className="rounded-full border border-line px-3 py-1 text-xs font-medium dark:border-white/15"
        >
          {allSelected ? "Deselect all" : "Select everything"}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {OPTIONS.map((o) => {
          const locked = o.id === "awards" && forcedAwards;
          return (
            <li key={o.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm dark:border-white/10">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={effective.has(o.id)}
                  disabled={locked || busy}
                  onChange={() => toggle(o.id)}
                />
                <span>
                  <span className="font-semibold">{o.label}</span>
                  <span className="block text-ink/60 dark:text-paper/60">{o.desc}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type CLEAR to confirm"
          disabled={busy}
          className="rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Clearing…" : `Clear ${effective.size || ""} selected`.replace("  ", " ")}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink/50 dark:text-paper/50">
        Visitors’ own devices keep a local copy of their passport; badges for projects that no longer exist are ignored automatically.
      </p>

      {result && (
        <p role="status" className={`mt-3 rounded-lg px-4 py-3 text-sm ${result.kind === "ok" ? "bg-teal-soft text-teal-deep" : "bg-coral-soft text-coral"}`}>
          {result.text}
        </p>
      )}
    </section>
  );
}
