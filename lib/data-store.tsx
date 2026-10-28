"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import { floorLabel } from "./format";
import type { Category, Location, Project, PointOfInterest } from "./types";

export { floorLabel };

export type Aggregate = { average: number; count: number; explorers: number };

type DataValue = {
  source: "live";
  loading: boolean;
  error: string | null;
  categories: Category[];
  locations: Location[];
  locationsById: Record<string, Location>;
  projects: Project[];
  pois: PointOfInterest[];
  /** floor number -> uploaded floorplan image url */
  floorplans: Record<number, string>;
  /** every floor number that exists (0..max) */
  floors: number[];
  categoryColorByProjectId: Record<string, string>;
  getAggregate: (projectId: string) => Aggregate;
  refresh: () => Promise<void>;
};

const ZERO: Aggregate = { average: 0, count: 0, explorers: 0 };

type Snapshot = {
  source: "live";
  categories: Category[];
  locations: Location[];
  projects: Project[];
  pois: PointOfInterest[];
  floorplans: Record<number, string>;
  stats: Record<string, Aggregate>;
};

const EMPTY_SNAPSHOT: Snapshot = { source: "live", categories: [], locations: [], projects: [], pois: [], floorplans: {}, stats: {} };

async function fetchSnapshot(): Promise<Snapshot> {
  const [cats, locs, projs, pois, plans, stats] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("locations").select("*"),
    supabase.from("projects").select("*").order("project_number"),
    supabase.from("points_of_interest").select("*"),
    supabase.from("floorplans").select("floor,image_url"),
    supabase.from("project_stats").select("*"),
  ]);

  const firstError = [cats, locs, projs, pois].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const categories: Category[] = (cats.data ?? []).map((c: any) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));
  const locations: Location[] = (locs.data ?? []).map((l: any) => ({
    id: l.id,
    building: l.building,
    floor: l.floor,
    room: l.room,
    placed: l.placed ?? true,
    node: { id: `${l.id}-node`, floor: l.floor, x: Number(l.x_coordinate), y: Number(l.y_coordinate), label: l.room },
  }));
  const projects: Project[] = (projs.data ?? []).map((p: any) => ({
    id: p.id,
    projectNumber: p.project_number,
    name: p.name,
    slug: p.slug,
    tagline: p.tagline ?? "",
    team: { id: String(p.team_id ?? ""), name: "", logoUrl: "", members: p.members ?? [] },
    members: p.members ?? [],
    problem: "",
    solution: "",
    impact: "",
    categoryId: p.category_id ?? "other",
    relatedCategoryIds: p.related_category_ids ?? [],
    locationId: p.location_id ?? "",
    about: p.description ?? "",
    featured: !!p.featured,
    active: p.active !== false,
  }));
  const poiList: PointOfInterest[] = (pois.data ?? []).map((p: any) => ({ id: p.id, kind: p.kind, label: p.label, locationId: p.location_id ?? "" }));
  const floorplans: Record<number, string> = {};
  (plans.data ?? []).forEach((r: any) => (floorplans[r.floor] = r.image_url));
  const statMap: Record<string, Aggregate> = {};
  (stats.data ?? []).forEach((r: any) => {
    statMap[r.project_id] = { average: Number(r.average), count: Number(r.count), explorers: Number(r.explorers) };
  });

  return { source: "live", categories, locations, projects, pois: poiList, floorplans, stats: statMap };
}

const DataContext = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      setSnap(await fetchSnapshot());
      setError(null);
    } catch (e: any) {
      console.warn("[khoj] could not load data", e);
      setError(e?.message ?? "Could not load data");
      setSnap(EMPTY_SNAPSHOT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<DataValue>(() => {
    const locationsById = Object.fromEntries(snap.locations.map((l) => [l.id, l]));
    const colorByCategory = Object.fromEntries(snap.categories.map((c) => [c.id, c.color]));
    const categoryColorByProjectId = Object.fromEntries(snap.projects.map((p) => [p.id, colorByCategory[p.categoryId] ?? "indigo"]));
    const maxFloor = Math.max(1, ...snap.locations.map((l) => l.floor), ...Object.keys(snap.floorplans).map(Number));
    const floors = Array.from({ length: maxFloor + 1 }, (_, i) => i);
    return {
      source: snap.source,
      loading,
      error,
      categories: snap.categories,
      locations: snap.locations,
      locationsById,
      projects: snap.projects,
      pois: snap.pois,
      floorplans: snap.floorplans,
      floors,
      categoryColorByProjectId,
      getAggregate: (id: string) => snap.stats[id] ?? ZERO,
      refresh,
    };
  }, [snap, loading, error, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
