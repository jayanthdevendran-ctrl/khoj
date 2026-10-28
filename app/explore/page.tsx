"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useProjectData } from "@/lib/project-data";
import { useVisitor } from "@/lib/visitor-store";
import { useFloorplan } from "@/lib/useFloorplan";
import { FLOORS, DEFAULT_FLOOR } from "@/lib/floors";
import { FLOOR_LAYOUTS, floorOfRoom, canonicalRoomKey } from "@/lib/floor-layouts";
import CategoryFilter from "@/components/CategoryFilter";
import { projectSubjectIds, subjectsByUse } from "@/lib/subjects";
import FloorMap, { type MapRoom } from "@/components/FloorMap";
import { RatingStarsReadonly } from "@/components/RatingStars";
import type { Project } from "@/lib/types";

type RoomGroup = { key: string; label: string; projects: Project[] };

export default function ExplorePage() {
  const { isBadgeCollected } = useVisitor();
  const { projects, locations, categories, getAggregate, loading } = useProjectData();
  const [floor, setFloor] = useState<number>(DEFAULT_FLOOR);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const floorplanUrl = useFloorplan(floor);

  // Every room that has projects, with its projects.
  const groups = useMemo(() => {
    const locationsById = new Map(locations.map((l) => [l.id, l]));
    const byKey = new Map<string, RoomGroup>();
    for (const p of projects) {
      if (categoryFilter && !projectSubjectIds(p).includes(categoryFilter)) continue;
      const room = locationsById.get(p.locationId)?.room?.trim();
      if (!room) continue;
      const key = canonicalRoomKey(room);
      const group = byKey.get(key) ?? { key, label: room, projects: [] };
      group.projects.push(p);
      byKey.set(key, group);
    }
    byKey.forEach((g) => g.projects.sort((a, b) => a.projectNumber - b.projectNumber));
    return byKey;
  }, [projects, locations, categoryFilter]);

  const subjectList = useMemo(() => subjectsByUse(categories, projects), [categories, projects]);

  const mapRooms: MapRoom[] = (FLOOR_LAYOUTS[floor] ?? []).map((room) => ({ ...room, count: groups.get(room.key)?.projects.length ?? 0 }));
  const floorCount = (id: number) => (FLOOR_LAYOUTS[id] ?? []).reduce((n, room) => n + (groups.get(room.key)?.projects.length ?? 0), 0);
  const otherRooms = Array.from(groups.values())
    .filter((g) => floorOfRoom(g.key) === null)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const selected = selectedKey ? groups.get(selectedKey) : undefined;
  const floorInfo = FLOORS.find((f) => f.id === floor) ?? FLOORS[0];

  function changeFloor(id: number) {
    setFloor(id);
    setSelectedKey(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">KHOJ Map</h1>
          <p className="text-sm text-ink/60 dark:text-paper/60">Tap a highlighted room to see the projects there.</p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line p-1 [scrollbar-width:none] dark:border-white/10 [&::-webkit-scrollbar]:hidden">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              onClick={() => changeFloor(f.id)}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                floor === f.id ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60"
              )}
            >
              {f.label}
              {floorCount(f.id) > 0 && <span className="ml-1 opacity-60">({floorCount(f.id)})</span>}
            </button>
          ))}
        </div>
      </div>

      {subjectList.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-paper/50">Filter by subject</p>
          <CategoryFilter active={categoryFilter} onChange={(id) => { setCategoryFilter(id); setSelectedKey(null); }} categories={subjectList} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl2 border border-line bg-white shadow-card dark:border-white/10 dark:bg-white/5">
            <FloorMap imageUrl={floorplanUrl} floorLabel={floorInfo.label} rooms={mapRooms} selectedKey={selectedKey} onSelect={setSelectedKey} />
          </div>

          {otherRooms.length > 0 && (
            <div className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
              <h2 className="font-display text-sm font-semibold">Rooms not shown on these floor plans</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {otherRooms.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setSelectedKey(g.key)}
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-sm font-medium",
                      selectedKey === g.key ? "border-gold bg-gold/30" : "border-line dark:border-white/15"
                    )}
                  >
                    {g.label} <span className="font-mono text-xs opacity-60">{g.projects.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Projects in the selected room */}
        <div>
          {selected ? (
            <div className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">{selected.label}</h2>
                  <p className="text-xs text-ink/50 dark:text-paper/50">
                    {selected.projects.length} project{selected.projects.length === 1 ? "" : "s"} in this room
                  </p>
                </div>
                <button onClick={() => setSelectedKey(null)} aria-label="Close" className="text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper">
                  ✕
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {selected.projects.map((p) => {
                  const agg = getAggregate(p.id);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/project/${p.slug}`}
                        className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                      >
                        {p.team.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.team.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mist font-mono text-xs font-semibold dark:bg-white/10">
                            {(p.team.name || p.name).slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.team.name && p.team.name !== p.name ? p.team.name : p.name}</span>
                          {p.team.name && p.team.name !== p.name && <span className="block truncate text-xs text-ink/50 dark:text-paper/50">{p.name}</span>}
                          <span className="mt-0.5 flex items-center gap-2">
                            <RatingStarsReadonly value={agg.average} />
                            <span className="font-mono text-[10px] text-ink/50 dark:text-paper/50">({agg.count})</span>
                            {isBadgeCollected(p.id) && <span className="text-[10px] font-semibold text-teal-deep dark:text-teal-soft">✓ Collected</span>}
                          </span>
                        </span>
                        <span aria-hidden className="text-ink/30 dark:text-paper/30">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
              <h2 className="font-display font-semibold">{loading ? "Loading…" : "How to use the map"}</h2>
              <p className="mt-2 text-xs text-ink/50 dark:text-paper/50">
                Highlighted rooms have projects — the number shows how many. Tap a room to list them, then tap a project to open its page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
