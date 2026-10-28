"use client";

import { ACHIEVEMENTS, computeStats } from "@/lib/achievements";
import { useProjectData } from "@/lib/project-data";
import { explorerCode } from "@/lib/explorer-code";
import { useVisitor } from "@/lib/visitor-store";
import CompassProgress from "@/components/CompassProgress";
import BadgeCard from "@/components/BadgeCard";
import StatsCard from "@/components/StatsCard";
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import AccountMenu from "@/components/AccountMenu";

const MILESTONES = [5, 10, 20, 30];

export default function PassportPage() {
  const { state, isBadgeCollected } = useVisitor();
  const { projects, loading } = useProjectData();
  const stats = computeStats(state.badges, state.ratings, projects);

  const completion = projects.length > 0 ? Math.round((stats.projectsExplored / projects.length) * 100) : 0;
  const lastBadgeProjectId = state.badges.at(-1)?.projectId;
  const [view, setView] = useState<"all" | "collected">("all");

  if (loading) return null;

  if (stats.projectsExplored === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">My KHOJ Passport</h1>
        <div className="mt-8 rounded-xl2 border border-dashed border-line p-10 dark:border-white/15">
          <p className="font-display font-semibold">Your passport is empty.</p>
          <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">
            Scan a project&apos;s QR code, rate it, and add its badge to start your collection.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/explore" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink">Find projects on the map</Link>
            <Link href="/projects" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold dark:border-white/20">Browse projects</Link>
          </div>
        </div>
        <AccountMenu variant="card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">My KHOJ Passport</h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Explorer ID <span className="font-mono">{explorerCode(state.explorerId)}</span>
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 rounded-xl2 border border-line bg-white p-6 shadow-card dark:border-white/10 dark:bg-white/5 md:flex-row">
        <CompassProgress value={stats.projectsExplored} total={projects.length} label="explored" />
        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
          <StatsCard label="Explored" value={stats.projectsExplored} />
          <StatsCard label="Badges" value={stats.projectsExplored} />
          <StatsCard label="Categories" value={stats.categoriesVisited} />
          <StatsCard label="Rated" value={stats.projectsRated} />
        </div>
      </div>

      {/* Exploration path */}
      <div className="mt-6 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">Your Exploration — {completion}% complete</h2>
        <div className="mt-4 flex items-center gap-2">
          {MILESTONES.map((m, i) => {
            const reached = stats.projectsExplored >= m;
            const label = `${m} Projects`;
            return (
              <div key={m} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={clsx(
                    "h-3 w-3 rounded-full border-2",
                    reached ? "border-gold bg-gold" : "border-line bg-transparent dark:border-white/20"
                  )}
                />
                <span className="text-center text-[10px] text-ink/50 dark:text-paper/50">{label}</span>
                <div className={clsx("h-0.5 w-full", i < MILESTONES.length - 1 ? (reached ? "bg-gold" : "bg-line dark:bg-white/10") : "bg-transparent")} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievements */}
      <div className="mt-6">
        <h2 className="font-display font-semibold">Achievements</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = state.unlockedAchievements.includes(a.id);
            return (
              <div
                key={a.id}
                className={clsx(
                  "rounded-xl2 border p-3",
                  unlocked ? "border-gold/50 bg-gold-soft/30 dark:bg-gold-deep/10" : "border-line bg-white dark:border-white/10 dark:bg-white/5"
                )}
              >
                <p className={clsx("font-display text-sm font-semibold", !unlocked && "text-ink/40 dark:text-paper/40")}>{a.name}</p>
                <p className="text-xs text-ink/50 dark:text-paper/50">{a.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badge grid */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold">
            {stats.projectsExplored} / {projects.length} Projects Explored
          </h2>
          <div className="flex gap-1 rounded-full border border-line p-1 dark:border-white/10" role="group" aria-label="Which badges to show">
            {([["all", `All ${projects.length}`], ["collected", `Collected ${stats.projectsExplored}`]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={clsx("rounded-full px-3.5 py-1.5 text-xs font-semibold", view === id ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {projects
            .filter((p) => view === "all" || isBadgeCollected(p.id))
            .map((p) => (
              <BadgeCard key={p.id} project={p} collected={isBadgeCollected(p.id)} justCollected={p.id === lastBadgeProjectId} />
            ))}
        </div>
      </div>
      <AccountMenu variant="card" />
    </div>
  );
}
