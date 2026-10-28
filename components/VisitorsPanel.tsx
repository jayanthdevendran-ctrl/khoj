"use client";

import { useEffect, useState } from "react";
import writeXlsxFile from "write-excel-file/browser";
import { supabase } from "@/lib/supabase";

type Row = { explorer_id: string; display_name: string; full_name?: string | null; email?: string | null; projects_visited: number; projects_rated: number; total_activity: number };

/** Admin tab: every account with how many projects they visited and rated. */
export default function VisitorsPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase.from("visitor_leaderboard").select("*").order("total_activity", { ascending: false });
    if (err) setError(err.message);
    else {
      setError(null);
      setRows((data ?? []) as Row[]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-xl2 border border-line p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Visitors</h2>
          <p className="text-sm text-ink/60 dark:text-paper/60">Every account, with how many projects they visited and rated.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-full border border-line px-4 py-2 text-sm dark:border-white/15">
            Refresh
          </button>
          {rows && rows.length > 0 && (
            <button
              onClick={() =>
                writeXlsxFile(
                  [
                    ["Rank", "Full name", "Leaderboard name", "Email", "Projects visited", "Projects rated", "Total"].map((value) => ({ value, fontWeight: "bold" as const })),
                    ...rows.map((r, i) => [i + 1, r.full_name ?? "", r.display_name, r.email ?? "", r.projects_visited, r.projects_rated, r.total_activity]),
                  ],
                  { columns: [{ width: 6 }, { width: 28 }, { width: 20 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 8 }] }
                ).toFile("khoj-visitors.xlsx")
              }
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink"
            >
              ⬇ Export to Excel
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error} — did you run the Supabase migrations (v5 and v6)?</p>}

      {rows && (
        <div className="mt-4 overflow-x-auto rounded-xl2 border border-line shadow-card dark:border-white/10">
          <table className="min-w-full divide-y divide-line text-sm dark:divide-white/10">
            <thead className="bg-mist/60 text-left text-xs uppercase tracking-wide text-ink/50 dark:bg-white/5 dark:text-paper/50">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Full name</th>
                <th className="px-4 py-2">Leaderboard name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Visited</th>
                <th className="px-4 py-2">Rated</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-white dark:divide-white/10 dark:bg-white/5">
              {rows.map((r, i) => (
                <tr key={r.explorer_id}>
                  <td className="px-4 py-2 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{r.full_name ?? <span className="text-ink/40">—</span>}</td>
                  <td className="px-4 py-2">{r.display_name}</td>
                  <td className="px-4 py-2 text-xs">{r.email ?? ""}</td>
                  <td className="px-4 py-2">{r.projects_visited}</td>
                  <td className="px-4 py-2">{r.projects_rated}</td>
                  <td className="px-4 py-2 font-semibold">{r.total_activity}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink/50">
                    No visitor activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
