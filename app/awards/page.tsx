"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { computeStats } from "@/lib/achievements";
import { explorerCode } from "@/lib/explorer-code";
import { useProjectData } from "@/lib/project-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { rankProjects, rankingParams } from "@/lib/ranking";
import { useVisitor } from "@/lib/visitor-store";
import Leaderboard, { LeaderboardRow } from "@/components/Leaderboard";
import CompassProgress from "@/components/CompassProgress";

type ExplorerEntry = { code: string; name: string; rated: number };
type Aggregate = { average: number; count: number };

const REFRESH_MS = 30000; // automatic refresh every 30 seconds

export default function AwardsPage() {
  const { state, setDisplayName } = useVisitor();
  const [tab, setTab] = useState<"choice" | "explorer">("choice");
  const { projects } = useProjectData();
  const stats = computeStats(state.badges, state.ratings, projects);
  const [explorers, setExplorers] = useState<ExplorerEntry[]>([]);
  const [liveStats, setLiveStats] = useState<Record<string, Aggregate>>({});

  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Both leaderboards refresh on their own as other visitors rate projects (and on demand).
  const refreshBoards = useCallback(async (manual = false) => {
    if (!isSupabaseConfigured) return;
    if (!manual && document.visibilityState === "hidden") return;
    setRefreshing(true);
    try {
      const [statRes, rankRes] = await Promise.all([
        supabase.from("project_stats").select("project_id,average,count"),
        supabase.from("explorer_ranking").select("display_name,explorer_code,projects_rated").order("projects_rated", { ascending: false }).limit(50),
      ]);
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
      if (statRes.data || rankRes.data) setUpdatedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void refreshBoards();
    const id = window.setInterval(() => void refreshBoards(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshBoards();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshBoards]);

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
          subtitle: [project.team.name !== project.name ? project.team.name : "", `avg ${r.average.toFixed(2)} ★`, `${r.count} rating${r.count === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
          value: `${r.score.toFixed(2)} pts`,
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
  const { m: ratingsNeeded } = rankingParams(projects.map((p) => aggregateOf(p.id)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Awards</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink/60 dark:text-paper/60">
          Updates automatically every 30 seconds
          {updatedAt && <span className="ml-1 opacity-70">· last updated {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
        </p>
        <button
          type="button"
          onClick={() => void refreshBoards(true)}
          disabled={refreshing}
          className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

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
            The ten top projects. Points are the average rating adjusted for how many people rated it: a project needs about {ratingsNeeded} ratings to be judged mostly on its own average, so a single lucky 5★ can’t beat a well-rated favourite.{" "}
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
          {(state.explorerId || !isSupabaseConfigured) && (
            <NicknameCard
              current={state.displayName ?? ""}
              onSave={async (name) => {
                const result = await setDisplayName(name);
                if (result.ok) void refreshBoards(true);
                return result;
              }}
            />
          )}
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

function NicknameCard({ current, onSave }: { current: string; onSave: (name: string) => Promise<{ ok: boolean; name?: string; error?: string }> }) {
  const [input, setInput] = useState(current);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    setInput(current);
  }, [current]);

  async function save() {
    setBusy(true);
    setNote(null);
    const result = await onSave(input);
    setBusy(false);
    setNote(result.ok ? { kind: "ok", text: `Saved. You appear as “${result.name}” on the Explorer leaderboard.` } : { kind: "error", text: result.error ?? "Couldn’t save that." });
  }

  return (
    <div className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
      <h2 className="font-display font-semibold">Your leaderboard name</h2>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        This is the name shown for you on the Explorer leaderboard. Use a nickname if you’d rather not show your own name. Leave it empty to go back to the default.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={24}
          placeholder="Choose a nickname"
          className="w-full max-w-xs rounded-full border border-line px-4 py-2 text-sm dark:border-white/15 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50 dark:bg-paper dark:text-ink"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {note && (
        <p role="status" className={clsx("mt-2 text-sm", note.kind === "ok" ? "text-teal-deep dark:text-teal-soft" : "text-coral")}>
          {note.text}
        </p>
      )}
    </div>
  );
}
