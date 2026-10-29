"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Category, Location, PointOfInterest, Project, Team } from "@/lib/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type Aggregate = { average: number; count: number; explorers: number };
const ZERO: Aggregate = { average: 0, count: 0, explorers: 0 };

type ProjectDataValue = {
  projects: Project[];
  categories: Category[];
  locations: Location[];
  teams: Team[];
  pointsOfInterest: PointOfInterest[];
  /** Colour key (gold / teal / indigo / coral) for each project, taken from its category. */
  categoryColorByProjectId: Record<string, string>;
  /** Live rating / visitor totals for a project (zeros until visitors rate it). */
  getAggregate: (projectId: string) => Aggregate;
  /** Re-reads the rating totals (cheap) without reloading everything. */
  refreshStats: () => Promise<void>;
  /** Immediately reflects a rating the student just gave, before the server totals catch up. */
  bumpAggregate: (projectId: string, rating: number) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  databaseMode: boolean;
};

const ProjectDataContext = createContext<ProjectDataValue | null>(null);

function toCategory(row: any): Category {
  const allowed = ["gold", "teal", "indigo", "coral"];
  return { id: String(row.id), name: row.name ?? String(row.id), icon: row.icon ?? "flask-conical", color: allowed.includes(row.color) ? row.color : "indigo" };
}

function toLocation(row: any): Location {
  const id = String(row.id);
  const room = row.room ?? "";
  return {
    id,
    building: row.building ?? "",
    floor: Number(row.floor ?? 0),
    room,
    node: { id: `node-${id}`, floor: Number(row.floor ?? 0), x: Number(row.x_coordinate ?? 50), y: Number(row.y_coordinate ?? 50), label: room },
  };
}

function toTeam(row: any): Team {
  return { id: String(row.id), name: row.name ?? "", logoUrl: row.logo_url ?? "", members: Array.isArray(row.members) ? row.members.map(String) : [] };
}

export function ProjectDataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [stats, setStats] = useState<Record<string, Aggregate>>({});
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const clearAll = useCallback(() => {
    setProjects([]);
    setCategories([]);
    setLocations([]);
    setTeams([]);
    setPointsOfInterest([]);
    setStats({});
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      clearAll();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [projectRes, categoryRes, locationRes, teamRes, poiRes, statRes] = await Promise.all([
        supabase.from("projects").select("*").eq("active", true).order("project_number", { ascending: true }),
        supabase.from("categories").select("*"),
        supabase.from("locations").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("points_of_interest").select("*"),
        supabase.from("project_stats").select("*"),
      ]);
      const failed = [projectRes, categoryRes, locationRes, teamRes, poiRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      const nextCategories = (categoryRes.data ?? []).map(toCategory);
      const nextLocations = (locationRes.data ?? []).map(toLocation);
      const nextTeams = (teamRes.data ?? []).map(toTeam);
      const locById = new Map(nextLocations.map((l) => [l.id, l]));
      const teamById = new Map(nextTeams.map((t) => [t.id, t]));
      const nextProjects: Project[] = (projectRes.data ?? []).map((row: any) => {
        const team = row.team_id ? teamById.get(String(row.team_id)) : undefined;
        const location = row.location_id ? locById.get(String(row.location_id)) : undefined;
        return {
          id: String(row.id),
          projectNumber: Number(row.project_number),
          name: String(row.name ?? ""),
          slug: String(row.slug ?? row.id),
          tagline: String(row.tagline ?? ""),
          team: team ?? { id: String(row.team_id ?? ""), name: "", logoUrl: "", members: [] },
          members: team?.members ?? [],
          relatedCategoryIds: Array.isArray(row.related_category_ids) ? row.related_category_ids.map(String) : [],
          categoryId: String(row.category_id ?? ""),
          locationId: location ? location.id : String(row.location_id ?? ""),
          about: String(row.description ?? ""),
          problem: String(row.problem ?? ""),
          solution: String(row.solution ?? ""),
          impact: String(row.impact ?? ""),
          featured: Boolean(row.featured),
          active: Boolean(row.active),
        };
      });
      const nextStats: Record<string, Aggregate> = {};
      (statRes.data ?? []).forEach((r: any) => {
        nextStats[String(r.project_id)] = { average: Number(r.average), count: Number(r.count), explorers: Number(r.explorers) };
      });

      setCategories(nextCategories);
      setLocations(nextLocations);
      setTeams(nextTeams);
      setProjects(nextProjects);
      setStats(nextStats);
      setPointsOfInterest((poiRes.data ?? []).map((row: any) => ({ id: String(row.id), kind: row.kind, label: String(row.label ?? row.kind), locationId: String(row.location_id ?? "") })) as PointOfInterest[]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load KHOJ data from Supabase.";
      setError(message);
      clearAll();
    } finally {
      setLoading(false);
    }
  }, [clearAll]);

  useEffect(() => { void refresh(); }, [refresh]);

  const refreshStats = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.from("project_stats").select("*");
    if (!data) return;
    const next: Record<string, Aggregate> = {};
    data.forEach((r: any) => {
      next[String(r.project_id)] = { average: Number(r.average), count: Number(r.count), explorers: Number(r.explorers) };
    });
    setStats(next);
  }, []);

  const bumpAggregate = useCallback((projectId: string, rating: number) => {
    setStats((prev) => {
      const cur = prev[projectId] ?? ZERO;
      const count = cur.count + 1;
      return { ...prev, [projectId]: { average: (cur.average * cur.count + rating) / count, count, explorers: cur.explorers } };
    });
  }, []);

  // Totals go stale while the tab is in the background, so refresh them when the student comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshStats();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshStats]);

  const value = useMemo<ProjectDataValue>(() => {
    const colorByCategory = Object.fromEntries(categories.map((c) => [c.id, c.color]));
    const categoryColorByProjectId = Object.fromEntries(projects.map((p) => [p.id, colorByCategory[p.categoryId] ?? "indigo"]));
    return {
      projects, categories, locations, teams, pointsOfInterest,
      categoryColorByProjectId,
      getAggregate: (id: string) => stats[id] ?? ZERO,
      refreshStats,
      bumpAggregate,
      loading, error, refresh, databaseMode: isSupabaseConfigured,
    };
  }, [projects, categories, locations, teams, pointsOfInterest, stats, loading, error, refresh, refreshStats, bumpAggregate]);
  return <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>;
}

export function useProjectData() {
  const value = useContext(ProjectDataContext);
  if (!value) throw new Error("useProjectData must be used inside ProjectDataProvider");
  return value;
}
