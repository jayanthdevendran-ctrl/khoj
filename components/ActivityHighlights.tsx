"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProjectData } from "@/lib/project-data";
import { rankProjects, rankProjectsOriginal, rankingParams } from "@/lib/ranking";

type Rater = { explorer_id: string; display_name: string; full_name?: string | null; email: string | null; projects_rated: number };

const MEDALS = ["🥇", "🥈", "🥉"];

/** Admin dashboard: the two award top-10s, each in its own section. */
export default function ActivityHighlights({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const { projects, getAggregate, refresh } = useProjectData();
  const [raters, setRaters] = useState<Rater[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("visitor_leaderboard")
      .select("*")
      .gt("projects_rated", 0)
      .order("projects_rated", { ascending: false })
      .order("last_rated_at", { ascending: true })
      .limit(10);
    if (err) {
      setError(err.message);
      setRaters([]);
    } else {
      setError(null);
      setRaters((data ?? []) as Rater[]);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
      void refresh();
    }, 15000);
    return () => window.clearInterval(id);
  }, [load, refresh, refreshSignal]);

  // Both ranking systems, side by side. "New" is what the public Awards page uses.
  const { newList, originalList, params } = useMemo(() => {
    const data = projects.map((p) => ({ id: p.id, ...getAggregate(p.id) }));
    const toRows = (ranked: { id: string; average: number; count: number; score: number }[]) =>
      ranked
        .filter((r) => r.count > 0)
        .map((r, i) => ({ rank: i + 1, project: projects.find((p) => p.id === r.id), average: r.average, count: r.count, score: r.score }))
        .filter((r): r is typeof r & { project: NonNullable<typeof r.project> } => Boolean(r.project));
    const fresh = toRows(rankProjects(data));
    const original = toRows(rankProjectsOriginal(data));
    return { newList: fresh, originalList: original, params: rankingParams(data) };
  }, [projects, getAggregate]);

  const otherRank = (list: typeof newList, id: string) => list.find((r) => r.project.id === id)?.rank;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Award standings</h2>
        <button
          onClick={() => {
            void load();
            void refresh();
          }}
          className="rounded-full border border-line px-4 py-1.5 text-sm dark:border-white/15"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">
          {error} — did you run supabase/v6_migration.sql?
        </p>
      )}

      <section className="rounded-xl2 border border-line p-4 dark:border-white/10">
        <h3 className="font-display font-semibold">🏆 People’s Choice — top 10 projects, two ranking systems</h3>
        <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">
          Both use the same ratings. The small “#” beside each project is its position in the other system.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <PcList
            title="New system (used on the public Awards page)"
            note={`Adaptive: a project needs about ${params.m} ratings to be judged on its own average · overall mean ${params.C.toFixed(2)}`}
            rows={newList.slice(0, 10)}
            otherRank={(id) => otherRank(originalList, id)}
          />
          <PcList
            title="Original system (simple average)"
            note="No algorithm: the plain average of the ratings, so one 5★ rating shows 5.00. Ties go to the project with more ratings."
            simple
            rows={originalList.slice(0, 10)}
            otherRank={(id) => otherRank(newList, id)}
          />
        </div>
      </section>

      <section className="rounded-xl2 border border-line p-4 dark:border-white/10">
        <h3 className="font-display font-semibold">🧭 Explorer — top 10 accounts by projects rated</h3>
        {raters === null ? (
          <p className="mt-3 text-sm text-ink/50 dark:text-paper/50">Loading…</p>
        ) : raters.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50 dark:text-paper/50">No ratings yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-line text-sm dark:divide-white/10">
            {raters.map((r, i) => (
              <li key={r.explorer_id} className="flex items-center gap-3 py-2">
                <span className="w-7 shrink-0 text-center font-mono text-xs text-ink/50 dark:text-paper/50">{i < 3 ? MEDALS[i] : i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{r.full_name || r.display_name}</span>
                  {r.email && <span className="ml-2 text-xs text-ink/50 dark:text-paper/50">{r.email}</span>}
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold">
                  {r.projects_rated} <span className="font-normal text-ink/50 dark:text-paper/50">rated</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

type PcRow = { rank: number; project: { id: string; name: string; team: { name: string } }; average: number; count: number; score: number };

function PcList({ title, note, rows, otherRank, simple = false }: { title: string; note: string; rows: PcRow[]; otherRank: (id: string) => number | undefined; simple?: boolean }) {
  return (
    <div className="rounded-xl border border-line p-3 dark:border-white/10">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-0.5 text-[11px] text-ink/50 dark:text-paper/50">{note}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink/50 dark:text-paper/50">No ratings yet.</p>
      ) : (
        <ol className="mt-2 divide-y divide-line text-sm dark:divide-white/10">
          {rows.map(({ rank, project, average, count, score }) => {
            const other = otherRank(project.id);
            return (
              <li key={project.id} className="flex items-center gap-2 py-2">
                <span className="w-7 shrink-0 text-center font-mono text-xs text-ink/50 dark:text-paper/50">{rank <= 3 ? MEDALS[rank - 1] : rank}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{project.name}</span>
                  {project.team.name && project.team.name !== project.name && (
                    <span className="ml-2 text-xs text-ink/50 dark:text-paper/50">{project.team.name}</span>
                  )}
                  {other !== undefined && other !== rank && <span className="ml-2 font-mono text-[10px] text-ink/40 dark:text-paper/40">#{other}</span>}
                </span>
                <span className="shrink-0 text-right font-mono text-xs font-semibold">
                  {simple ? `${average.toFixed(2)} ★` : `${score.toFixed(2)} pts`}
                  <span className="block font-normal text-ink/50 dark:text-paper/50">{simple ? `${count} rating${count === 1 ? "" : "s"}` : `avg ${average.toFixed(2)} ★ · ${count}`}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
