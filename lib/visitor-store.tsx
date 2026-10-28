"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import type { VisitorState, BadgeRecord, RatingRecord } from "./types";
import { ACHIEVEMENTS, computeStats } from "./achievements";
import { useProjectData } from "./project-data";
import { supabase, isSupabaseConfigured } from "./supabase";

// Each signed-in student account has its own badges and ratings, stored in Supabase
// (badge_logs / rating_logs) and loaded again whenever that account signs in. Nothing is
// kept on the device, so switching accounts never shows another account's passport.

function emptyState(): VisitorState {
  return { explorerId: "", displayName: null, badges: [], ratings: [], unlockedAchievements: [], lastScannedAt: null };
}

type ScanResult =
  | { status: "new"; badge: BadgeRecord }
  | { status: "already-collected" }
  | { status: "invalid" };

type VisitorContextValue = {
  state: VisitorState;
  hydrated: boolean;
  isBadgeCollected: (projectId: string) => boolean;
  hasRated: (projectId: string) => boolean;
  collectBadge: (projectId: string) => ScanResult;
  submitRating: (projectId: string, rating: number) => { status: "saved" | "already-rated" | "signed-out" };
  setDisplayName: (name: string) => void;
  newlyUnlockedAchievements: string[];
  clearNewlyUnlocked: () => void;
};

const VisitorContext = createContext<VisitorContextValue | null>(null);

export function VisitorProvider({ children }: { children: ReactNode }) {
  const { projects } = useProjectData();
  const [state, setState] = useState<VisitorState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [newlyUnlockedAchievements, setNewlyUnlocked] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedUser = useRef<string | null>(null);
  const pendingWrites = useRef(0);
  const signedIn = Boolean(state.explorerId);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setHydrated(true);
      return;
    }
    let cancelled = false;

    async function load(user: { id: string; email?: string | null; user_metadata?: Record<string, any> } | null) {
      if (!user) {
        loadedUser.current = null;
        setState(emptyState());
        setNewlyUnlocked([]);
        setHydrated(true);
        return;
      }
      loadedUser.current = user.id;
      const name = String(user.user_metadata?.full_name || user.email?.split("@")[0] || "").slice(0, 24);
      const reg = await supabase.rpc("register_visitor", { p_display_name: name });
      if (reg.error) console.warn("[khoj] could not register visitor — run supabase/v5_migration.sql", reg.error.message);
      const [b, r] = await Promise.all([
        supabase.from("badge_logs").select("project_id,collected_at").eq("explorer_id", user.id),
        supabase.from("rating_logs").select("project_id,rating,rated_at").eq("explorer_id", user.id),
      ]);
      if (cancelled || loadedUser.current !== user.id) return;
      const badges: BadgeRecord[] = (b.data ?? []).map((x: any) => ({ projectId: String(x.project_id), collectedAt: x.collected_at }));
      const ratings: RatingRecord[] = (r.data ?? []).map((x: any) => ({ projectId: String(x.project_id), rating: Number(x.rating), ratedAt: x.rated_at }));
      setState({
        explorerId: user.id,
        displayName: name || null,
        badges,
        ratings,
        unlockedAchievements: [],
        lastScannedAt: badges.map((x) => x.collectedAt).sort().pop() ?? null,
      });
      setNewlyUnlocked([]);
      setHydrated(true);
    }

    // Keep this account in step with the database (other devices, or an admin clearing records).
    async function resync() {
      const uid = loadedUser.current;
      if (!uid || pendingWrites.current > 0 || document.visibilityState === "hidden") return;
      const [b, r] = await Promise.all([
        supabase.from("badge_logs").select("project_id,collected_at").eq("explorer_id", uid),
        supabase.from("rating_logs").select("project_id,rating,rated_at").eq("explorer_id", uid),
      ]);
      if (cancelled || loadedUser.current !== uid || pendingWrites.current > 0 || b.error || r.error) return;
      const badges: BadgeRecord[] = (b.data ?? []).map((x: any) => ({ projectId: String(x.project_id), collectedAt: x.collected_at }));
      const ratings: RatingRecord[] = (r.data ?? []).map((x: any) => ({ projectId: String(x.project_id), rating: Number(x.rating), ratedAt: x.rated_at }));
      setState((s) => {
        const same =
          s.badges.length === badges.length && s.ratings.length === ratings.length &&
          badges.every((x) => s.badges.some((y) => y.projectId === x.projectId)) &&
          ratings.every((x) => s.ratings.some((y) => y.projectId === x.projectId));
        return same ? s : { ...s, badges, ratings };
      });
    }
    const resyncTimer = window.setInterval(resync, 30000);
    document.addEventListener("visibilitychange", resync);

    supabase.auth.getSession().then(({ data }) => {
      void load(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      // Token refreshes and repeated "signed in" pings for the same account must not reset anything.
      if (user && user.id === loadedUser.current && event !== "USER_UPDATED") return;
      void load(user);
    });
    return () => {
      cancelled = true;
      window.clearInterval(resyncTimer);
      document.removeEventListener("visibilitychange", resync);
      listener.subscription.unsubscribe();
    };
  }, []);

  // Achievements are worked out from this account's own badges and ratings.
  const stats = useMemo(() => computeStats(state.badges, state.ratings, projects), [state.badges, state.ratings, projects]);
  const unlocked = useMemo(() => ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.id), [stats]);
  const exposedState = useMemo<VisitorState>(() => ({ ...state, unlockedAchievements: unlocked }), [state, unlocked]);

  const isBadgeCollected = (projectId: string) => state.badges.some((b) => b.projectId === projectId);
  const hasRated = (projectId: string) => state.ratings.some((r) => r.projectId === projectId);

  function newlyUnlockedBy(nextBadges: BadgeRecord[], nextRatings: RatingRecord[]) {
    const next = computeStats(nextBadges, nextRatings, projects);
    return ACHIEVEMENTS.filter((a) => a.check(next) && !unlocked.includes(a.id)).map((a) => a.id);
  }

  async function persist(table: "badge_logs" | "rating_logs", row: Record<string, unknown>, rollback: () => void) {
    const write = () => supabase.from(table).upsert(row, { onConflict: "explorer_id,project_id", ignoreDuplicates: true });
    pendingWrites.current += 1;
    let { error } = await write();
    if (error?.code === "23503") {
      // The visitor row is missing (e.g. records were cleared) — recreate it and try once more.
      await supabase.rpc("register_visitor", { p_display_name: state.displayName ?? "" });
      ({ error } = await write());
    }
    pendingWrites.current -= 1;
    if (error) {
      console.warn(`[khoj] could not save to ${table}`, error);
      rollback();
      setSaveError(`Couldn’t save that to your account (${error.message}). Please try again.`);
    }
  }

  function collectBadge(projectId: string): ScanResult {
    if (isSupabaseConfigured && !signedIn) return { status: "invalid" };
    if (isBadgeCollected(projectId)) return { status: "already-collected" };

    const badge: BadgeRecord = { projectId, collectedAt: new Date().toISOString() };
    const nextBadges = [...state.badges, badge];
    const fresh = newlyUnlockedBy(nextBadges, state.ratings);

    setState((s) => ({ ...s, badges: nextBadges, lastScannedAt: badge.collectedAt }));
    if (fresh.length) setNewlyUnlocked((prev) => [...prev, ...fresh]);
    if (isSupabaseConfigured) {
      void persist("badge_logs", { explorer_id: state.explorerId, project_id: projectId, collected_at: badge.collectedAt }, () =>
        setState((s) => ({ ...s, badges: s.badges.filter((b) => b.projectId !== projectId) }))
      );
    }
    return { status: "new", badge };
  }

  function submitRating(projectId: string, rating: number) {
    if (isSupabaseConfigured && !signedIn) return { status: "signed-out" as const };
    if (hasRated(projectId)) return { status: "already-rated" as const };
    const record: RatingRecord = { projectId, rating, ratedAt: new Date().toISOString() };
    const nextRatings = [...state.ratings, record];
    const fresh = newlyUnlockedBy(state.badges, nextRatings);

    setState((s) => ({ ...s, ratings: nextRatings }));
    if (fresh.length) setNewlyUnlocked((prev) => [...prev, ...fresh]);
    if (isSupabaseConfigured) {
      void persist("rating_logs", { explorer_id: state.explorerId, project_id: projectId, rating, rated_at: record.ratedAt }, () =>
        setState((s) => ({ ...s, ratings: s.ratings.filter((r) => r.projectId !== projectId) }))
      );
    }
    return { status: "saved" as const };
  }

  function setDisplayName(name: string) {
    const trimmed = name.slice(0, 24);
    setState((s) => (s.explorerId ? { ...s, displayName: trimmed } : s));
    if (isSupabaseConfigured) void supabase.rpc("register_visitor", { p_display_name: trimmed });
  }

  const value = useMemo(
    () => ({
      state: exposedState,
      hydrated,
      isBadgeCollected,
      hasRated,
      collectBadge,
      submitRating,
      setDisplayName,
      newlyUnlockedAchievements,
      clearNewlyUnlocked: () => setNewlyUnlocked([]),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exposedState, hydrated, newlyUnlockedAchievements, projects]
  );

  return (
    <VisitorContext.Provider value={value}>
      {children}
      {saveError && (
        <div role="alert" className="fixed inset-x-3 bottom-4 z-[70] mx-auto max-w-md rounded-xl bg-coral px-4 py-3 text-sm text-white shadow-card">
          {saveError}{" "}
          <button onClick={() => setSaveError(null)} className="ml-1 font-semibold underline">
            Dismiss
          </button>
        </div>
      )}
    </VisitorContext.Provider>
  );
}

export function useVisitor() {
  const ctx = useContext(VisitorContext);
  if (!ctx) throw new Error("useVisitor must be used within VisitorProvider");
  return ctx;
}
