"use client";

import { useEffect, useState } from "react";
import writeXlsxFile from "write-excel-file/browser";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";

type Row = { explorer_id: string; display_name: string; projects_visited: number; projects_rated: number; total_activity: number };

export default function AdminVisitorsPage() {
  const ready = useAdminGuard();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase.from("visitor_leaderboard").select("*").order("total_activity", { ascending: false });
    if (err) setError(err.message);
    else setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <AdminNav />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Visitors</h1>
          <p className="text-sm text-ink/60 dark:text-paper/60">Who has visited and rated the most projects, by the name they entered.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="rounded-full border border-line px-4 py-2 text-sm dark:border-white/15">Refresh</button>
          {rows && rows.length > 0 && (
            <button
              onClick={() =>
                writeXlsxFile(
                  [
                    ["Rank", "Name", "Explorer ID", "Projects visited", "Projects rated", "Total"].map((value) => ({ value, fontWeight: "bold" as const })),
                    ...rows.map((r, i) => [i + 1, r.display_name, r.explorer_id, r.projects_visited, r.projects_rated, r.total_activity]),
                  ],
                  { columns: [{ width: 6 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 8 }] }
                ).toFile("khoj-visitors.xlsx")
              }
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink"
            >
              ⬇ Export to Excel
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error} — did you run supabase/v2_migration.sql?</p>}

      {rows && (
        <div className="mt-4 overflow-x-auto rounded-xl2 border border-line shadow-card dark:border-white/10">
          <table className="min-w-full divide-y divide-line text-sm dark:divide-white/10">
            <thead className="bg-mist/60 text-left text-xs uppercase tracking-wide text-ink/50 dark:bg-white/5 dark:text-paper/50">
              <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">ID</th><th className="px-4 py-2">Visited</th><th className="px-4 py-2">Rated</th><th className="px-4 py-2">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-line bg-white dark:divide-white/10 dark:bg-white/5">
              {rows.map((r, i) => (
                <tr key={r.explorer_id}>
                  <td className="px-4 py-2 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{r.display_name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.explorer_id}</td>
                  <td className="px-4 py-2">{r.projects_visited}</td>
                  <td className="px-4 py-2">{r.projects_rated}</td>
                  <td className="px-4 py-2 font-semibold">{r.total_activity}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-ink/50">No visitor activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
