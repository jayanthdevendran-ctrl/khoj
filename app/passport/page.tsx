"use client";

import { useState } from "react";
import { ACHIEVEMENTS, computeStats } from "@/lib/achievements";
import { useProjectData } from "@/lib/project-data";
import { explorerCode } from "@/lib/explorer-code";
import { useVisitor } from "@/lib/visitor-store";
import CompassProgress from "@/components/CompassProgress";
import BadgeCard from "@/components/BadgeCard";
import StatsCard from "@/components/StatsCard";
import clsx from "clsx";

const MILESTONES = [10, 25, 50];

export default function PassportPage() {
  const { state, isBadgeCollected } = useVisitor();
  const { projects, loading } = useProjectData();
  const stats = computeStats(state.badges, state.ratings, projects);
  const [nameInput, setNameInput] = useState(state.displayName ?? "");
  const { setDisplayName } = useVisitor();

  const completion = projects.length > 0 ? Math.round((stats.projectsExplored / projects.length) * 100) : 0;
  const lastBadgeProjectId = state.badges.at(-1)?.projectId;

  if (loading) return null;

  if (stats.projectsExplored === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">My KHOJ Passport</h1>
        <div className="mt-8 rounded-xl2 border border-dashed border-line p-10 dark:border-white/15">
          <p className="font-display font-semibold">Your passport is empty.</p>
          <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">
            Start exploring KHOJ to collect your first badge.
          </p>
        </div>
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
          {[...MILESTONES, projects.length].map((m, i) => {
            const reached = stats.projectsExplored >= m;
            const label = m === projects.length ? "All Projects" : `${m} Projects`;
            return (
              <div key={m} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={clsx(
                    "h-3 w-3 rounded-full border-2",
                    reached ? "border-gold bg-gold" : "border-line bg-transparent dark:border-white/20"
                  )}
                />
                <span className="text-center text-[10px] text-ink/50 dark:text-paper/50">{label}</span>
                {i < MILESTONES.length && <div className="h-0.5 w-full bg-line dark:bg-white/10" />}
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
        <h2 className="font-display font-semibold">
          {stats.projectsExplored} / {projects.length} Projects Explored
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {projects.map((p) => (
            <BadgeCard key={p.id} project={p} collected={isBadgeCollected(p.id)} justCollected={p.id === lastBadgeProjectId} />
          ))}
        </div>
      </div>

      {/* Display name for leaderboard */}
      <div className="mt-8 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">Leaderboard Nickname</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          Optional — shown instead of your Explorer ID on public leaderboards. Never shares personal contact details.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={24}
            placeholder="Choose a nickname"
            className="w-full max-w-xs rounded-full border border-line px-4 py-2 text-sm dark:border-white/15 dark:bg-white/5"
          />
          <button
            onClick={() => setDisplayName(nameInput)}
            className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
