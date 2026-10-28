"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProjectData } from "@/lib/project-data";
import { rankProjects } from "@/lib/ranking";

type Rater = { explorer_id: string; display_name: string; email: string | null; projects_rated: number };

const MEDALS = ["🥇", "🥈", "🥉"];

/** Admin dashboard: the two award top-10s, each in its own section. */
export default function ActivityHighlights({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const { projects, getAggregate, refresh } = useProjectData();
  const [raters, setRaters] = useState<Rater[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("visitor_leaderboard")
      .select("explorer_id,display_name,email,projects_rated")
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

  // Same ranking the public Awards page uses (weighted so a single 5★ can't beat a well-rated project).
  const topProjects = useMemo(() => {
    const rated = rankProjects(projects.map((p) => ({ id: p.id, ...getAggregate(p.id) }))).filter((r) => r.count > 0);
    return rated.slice(0, 10).flatMap((r) => {
      const project = projects.find((p) => p.id === r.id);
      return project ? [{ project, average: r.average, count: r.count }] : [];
    });
  }, [projects, getAggregate]);

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
        <h3 className="font-display font-semibold">🏆 People’s Choice — top 10 highest rated projects</h3>
        {topProjects.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50 dark:text-paper/50">No ratings yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-line text-sm dark:divide-white/10">
            {topProjects.map(({ project, average, count }, i) => (
              <li key={project.id} className="flex items-center gap-3 py-2">
                <span className="w-7 shrink-0 text-center font-mono text-xs text-ink/50 dark:text-paper/50">{i < 3 ? MEDALS[i] : i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{project.name}</span>
                  {project.team.name && project.team.name !== project.name && (
                    <span className="ml-2 text-xs text-ink/50 dark:text-paper/50">{project.team.name}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold">
                  {average.toFixed(2)} ★ <span className="font-normal text-ink/50 dark:text-paper/50">· {count} rating{count === 1 ? "" : "s"}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
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
                  <span className="font-medium">{r.display_name}</span>
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
