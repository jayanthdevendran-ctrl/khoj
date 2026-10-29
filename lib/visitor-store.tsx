"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import type { VisitorState, BadgeRecord, RatingRecord } from "./types";
import { ACHIEVEMENTS, computeStats } from "./achievements";
import { useProjectData } from "./project-data";
import { supabase, isSupabaseConfigured } from "./supabase";
import { shortName } from "./names";

// Each signed-in student account has its own badges and ratings, stored in Supabase
// (badge_logs / rating_logs) and loaded again whenever that account signs in. Nothing is
// kept on the device, so switching accounts never shows another account's passport.

/** The full name this device last saved for an account, so it is never asked for twice. */
function readRememberedName(accountId: string): string {
  try {
    return String(window.localStorage.getItem(`khoj:fullname:${accountId}`) ?? "").trim();
  } catch {
    return "";
  }
}

export type LastScan = { projectId: string; at: string };

function readLastScan(accountId: string): LastScan | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`khoj:lastscan:${accountId}`) ?? "null");
    return parsed && typeof parsed.projectId === "string" ? { projectId: parsed.projectId, at: String(parsed.at ?? "") } : null;
  } catch {
    return null;
  }
}

function readScanned(accountId: string): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`khoj:scanned:${accountId}`) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function emptyState(): VisitorState {
  return { explorerId: "", displayName: null, fullName: null, badges: [], ratings: [], unlockedAchievements: [], lastScannedAt: null };
}

type ScanResult =
  | { status: "new"; badge: BadgeRecord }
  | { status: "already-collected" }
  | { status: "not-scanned" }
  | { status: "not-rated" }
  | { status: "invalid" };

type VisitorContextValue = {
  state: VisitorState;
  hydrated: boolean;
  isBadgeCollected: (projectId: string) => boolean;
  hasRated: (projectId: string) => boolean;
  collectBadge: (projectId: string) => ScanResult;
  submitRating: (projectId: string, rating: number) => { status: "saved" | "already-rated" | "signed-out" | "not-scanned" };
  /** The most recent project QR code this account scanned (used to show "you are here" on the map). */
  lastScan: LastScan | null;
  /** Removes the "you are here" marker. */
  clearLastScan: () => void;
  /** True when a signed-in account has no student full name saved yet (the site then asks for it). */
  needsFullName: boolean;
  /** Saves the student's full name. */
  saveFullName: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** True once this account has opened the project from its QR code (?scan=1). */
  isScanned: (projectId: string) => boolean;
  /** Records that the project's QR code was scanned. Returns false if the student isn't signed in yet. */
  markScanned: (projectId: string) => boolean;
  /** Saves this account's leaderboard nickname. Empty text goes back to the default name. */
  setDisplayName: (name: string) => Promise<{ ok: boolean; name?: string; error?: string }>;
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
  const [scannedIds, setScannedIds] = useState<string[]>([]);
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [nameGateActive, setNameGateActive] = useState(false); // false until the full-name database change (v11) is in place
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
        setScannedIds([]);
        setLastScan(null);
        setState(emptyState());
        setNewlyUnlocked([]);
        setHydrated(true);
        return;
      }
      loadedUser.current = user.id;
      // Starting leaderboard name: "First L." from the full name entered at sign-up (full names are never shown publicly).
      // The name saved in the account profile (from sign-up or an earlier prompt), else the one this device remembers.
      const signUpFullName = String(user.user_metadata?.full_name ?? "").trim() || readRememberedName(user.id);
      const name = (signUpFullName ? shortName(signUpFullName) : String(user.email?.split("@")[0] ?? "")).slice(0, 24);
      let reg = await supabase.rpc("register_visitor", { p_display_name: name, p_full_name: signUpFullName });
      if (reg.error) {
        // Database not updated to v11 yet: fall back to the older call so signing in still works.
        reg = await supabase.rpc("register_visitor", { p_display_name: name });
        if (reg.error) console.warn("[khoj] could not register visitor — run the Supabase migrations", reg.error.message);
      }
      // The saved leaderboard nickname (if the student chose one) wins over the starting name.
      let own = await supabase.from("visitors").select("display_name,full_name").eq("explorer_id", user.id).maybeSingle();
      let gate = true;
      if (own.error) {
        gate = false; // full_name column not there yet (v11 not run)
        own = (await supabase.from("visitors").select("display_name").eq("explorer_id", user.id).maybeSingle()) as typeof own;
      }
      const savedName = own.data?.display_name ? String(own.data.display_name) : name;
      // If the database copy is missing (e.g. records were cleared) fall back to the remembered name, so the prompt never reappears.
      const savedFullName = (own.data as { full_name?: string | null } | null)?.full_name || signUpFullName || null;
      const [b, r] = await Promise.all([
        supabase.from("badge_logs").select("project_id,collected_at").eq("explorer_id", user.id),
        supabase.from("rating_logs").select("project_id,rating,rated_at").eq("explorer_id", user.id),
      ]);
      if (cancelled || loadedUser.current !== user.id) return;
      setScannedIds(readScanned(user.id));
      setLastScan(readLastScan(user.id));
      const badges: BadgeRecord[] = (b.data ?? []).map((x: any) => ({ projectId: String(x.project_id), collectedAt: x.collected_at }));
      const ratings: RatingRecord[] = (r.data ?? []).map((x: any) => ({ projectId: String(x.project_id), rating: Number(x.rating), ratedAt: x.rated_at }));
      setNameGateActive(gate);
      setState({
        explorerId: user.id,
        displayName: savedName || null,
        fullName: savedFullName,
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

  const isScanned = (projectId: string) => !isSupabaseConfigured || scannedIds.includes(projectId);

  // Opening a project from its QR code (?scan=1) unlocks rating and the passport badge for that project.
  // The unlock is remembered on this device for this account.
  function markScanned(projectId: string): boolean {
    if (isSupabaseConfigured && !signedIn) return false;
    setScannedIds((prev) => (prev.includes(projectId) ? prev : [...prev, projectId]));
    try {
      const key = `khoj:scanned:${state.explorerId || "local"}`;
      const current: string[] = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      if (!current.includes(projectId)) window.localStorage.setItem(key, JSON.stringify([...current, projectId]));
    } catch {}
    // Remember where the student is: the room of the project they just scanned.
    const here: LastScan = { projectId, at: new Date().toISOString() };
    setLastScan(here);
    try {
      window.localStorage.setItem(`khoj:lastscan:${state.explorerId || "local"}`, JSON.stringify(here));
    } catch {}
    return true;
  }

  function clearLastScan() {
    setLastScan(null);
    try {
      window.localStorage.removeItem(`khoj:lastscan:${state.explorerId || "local"}`);
    } catch {}
  }

  function collectBadge(projectId: string): ScanResult {
    if (isSupabaseConfigured && !signedIn) return { status: "invalid" };
    if (!isScanned(projectId)) return { status: "not-scanned" };
    if (isBadgeCollected(projectId)) return { status: "already-collected" };
    // The badge unlocks only after the student has rated the project.
    if (!hasRated(projectId)) return { status: "not-rated" };

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
    if (!isScanned(projectId)) return { status: "not-scanned" as const };
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

  async function saveFullName(name: string): Promise<{ ok: boolean; error?: string }> {
    const trimmed = name.trim();
    if (!isSupabaseConfigured) {
      setState((s) => ({ ...s, fullName: trimmed }));
      return { ok: true };
    }
    if (!signedIn) return { ok: false, error: "Please sign in first." };
    const { data, error } = await supabase.rpc("set_full_name", { p_name: trimmed });
    if (error) return { ok: false, error: error.message };
    const saved = String(data ?? trimmed);
    // Remember it on this device and in the account profile too, so it survives even if the database copy is wiped.
    try {
      window.localStorage.setItem(`khoj:fullname:${state.explorerId}`, saved);
    } catch {}
    void supabase.auth.updateUser({ data: { full_name: saved } });
    setState((s) => ({ ...s, fullName: saved }));
    return { ok: true };
  }

  async function setDisplayName(name: string): Promise<{ ok: boolean; name?: string; error?: string }> {
    const trimmed = name.trim().slice(0, 24);
    if (!isSupabaseConfigured) {
      setState((s) => ({ ...s, displayName: trimmed || null }));
      return { ok: true, name: trimmed };
    }
    if (!signedIn) return { ok: false, error: "Please sign in first." };
    const { data, error } = await supabase.rpc("set_display_name", { p_name: trimmed });
    if (error) {
      const missing = /set_display_name|schema cache|could not find the function/i.test(error.message);
      return { ok: false, error: missing ? "The nickname feature isn't switched on yet — run supabase/v10_migration.sql." : error.message };
    }
    const saved = String(data ?? trimmed);
    setState((s) => ({ ...s, displayName: saved }));
    return { ok: true, name: saved };
  }

  const value = useMemo(
    () => ({
      state: exposedState,
      hydrated,
      isBadgeCollected,
      hasRated,
      isScanned,
      needsFullName: hydrated && signedIn && nameGateActive && !state.fullName,
      saveFullName,
      lastScan,
      clearLastScan,
      markScanned,
      collectBadge,
      submitRating,
      setDisplayName,
      newlyUnlockedAchievements,
      clearNewlyUnlocked: () => setNewlyUnlocked([]),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exposedState, hydrated, newlyUnlockedAchievements, projects, scannedIds, lastScan]
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
