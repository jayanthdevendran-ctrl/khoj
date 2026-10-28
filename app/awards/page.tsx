"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { computeStats } from "@/lib/achievements";
import { explorerCode } from "@/lib/explorer-code";
import { useProjectData } from "@/lib/project-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { rankProjects } from "@/lib/ranking";
import { useVisitor } from "@/lib/visitor-store";
import Leaderboard, { LeaderboardRow } from "@/components/Leaderboard";
import CompassProgress from "@/components/CompassProgress";

type ExplorerEntry = { code: string; name: string; rated: number };
type Aggregate = { average: number; count: number };

const REFRESH_MS = 8000;

export default function AwardsPage() {
  const { state } = useVisitor();
  const [tab, setTab] = useState<"choice" | "explorer">("choice");
  const { projects } = useProjectData();
  const stats = computeStats(state.badges, state.ratings, projects);
  const [explorers, setExplorers] = useState<ExplorerEntry[]>([]);
  const [liveStats, setLiveStats] = useState<Record<string, Aggregate>>({});

  // Both leaderboards refresh on their own as other visitors rate projects.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    async function refreshBoards() {
      if (document.visibilityState === "hidden") return;
      const [statRes, rankRes] = await Promise.all([
        supabase.from("project_stats").select("project_id,average,count"),
        supabase.from("explorer_ranking").select("display_name,explorer_code,projects_rated").order("projects_rated", { ascending: false }).limit(50),
      ]);
      if (cancelled) return;
      if (statRes.data) {
        const next: Record<string, Aggregate> = {};
        statRes.data.forEach((r: any) => {
          next[String(r.project_id)] = { average: Number(r.average), count: Number(r.count) };
        });
        setLiveStats(next);
      }
      if (rankRes.data) {
        setExplorers(rankRes.data.map((r: any) => ({ code: String(r.explorer_code), name: String(r.display_name ?? ""), rated: Number(r.projects_rated) })));
      }
    }
    void refreshBoards();
    const id = window.setInterval(refreshBoards, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshBoards);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refreshBoards);
    };
  }, []);

  const aggregateOf = (id: string): Aggregate => liveStats[id] ?? { average: 0, count: 0 };
  const ranked = rankProjects(projects.map((p) => ({ id: p.id, ...aggregateOf(p.id) })));
  const choiceRows: LeaderboardRow[] = ranked
    .filter((r) => r.count > 0)
    .slice(0, 10)
    .flatMap((r, i) => {
      const project = projects.find((p) => p.id === r.id);
      if (!project) return [];
      return [
        {
          key: r.id,
          rank: i + 1,
          title: project.name,
          subtitle: [project.team.name !== project.name ? project.team.name : "", `${r.count} rating${r.count === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
          value: `${r.average.toFixed(2)} ★`,
        },
      ];
    });

  const myCode = explorerCode(state.explorerId);
  const explorerRows: LeaderboardRow[] = explorers
    .map((e, i) => ({
      key: `${e.code}-${i}`,
      rank: i + 1,
      title: e.name || `Explorer ${e.code}`,
      value: `${e.rated} rated`,
      highlight: e.code === myCode,
    }))
    .filter((row, i) => i < 10 || row.highlight);

  const hasRankings = choiceRows.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Awards</h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Both leaderboards update live as visitors rate projects.
      </p>

      <div className="mt-4 flex gap-1 rounded-full border border-line p-1 dark:border-white/10">
        <TabButton active={tab === "choice"} onClick={() => setTab("choice")}>
          🏆 People&apos;s Choice
        </TabButton>
        <TabButton active={tab === "explorer"} onClick={() => setTab("explorer")}>
          🧭 Explorer Award
        </TabButton>
      </div>

      {tab === "choice" ? (
        <div className="mt-5">
          <p className="mb-3 text-xs text-ink/50 dark:text-paper/50">
            The ten highest rated projects. Ranked by a weighted score that accounts for the number of ratings, not raw averages alone.{" "}
            <Link href="/projects" className="underline">
              Rate a project →
            </Link>
          </p>
          {hasRankings ? <Leaderboard rows={choiceRows} /> : (
            <EmptyState text="Rankings will appear once visitors start rating projects." />
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex flex-col items-center gap-4 rounded-xl2 border border-line bg-white p-6 shadow-card dark:border-white/10 dark:bg-white/5 md:flex-row">
            <CompassProgress value={stats.projectsRated} total={projects.length} label="rated" />
            <div className="text-center md:text-left">
              <p className="font-display text-lg font-semibold">Your Progress</p>
              <p className="text-sm text-ink/60 dark:text-paper/60">{stats.projectsRated} Projects Rated</p>
              <Link href="/projects" className="mt-3 inline-block rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink">
                Rate more projects
              </Link>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs text-ink/50 dark:text-paper/50">
              The ten accounts that have rated the most projects, with the number each has rated.
            </p>
            {explorerRows.length > 0 ? <Leaderboard rows={explorerRows} /> : (
              <EmptyState text="The Explorer leaderboard will appear once visitors start rating projects." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-full px-4 py-2 text-sm font-semibold",
        active ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl2 border border-dashed border-line p-10 text-center dark:border-white/15">
      <p className="text-sm text-ink/50 dark:text-paper/50">{text}</p>
    </div>
  );
}
