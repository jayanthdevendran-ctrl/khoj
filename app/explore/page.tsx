"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useProjectData } from "@/lib/project-data";
import { useVisitor } from "@/lib/visitor-store";
import { useFloorplan } from "@/lib/useFloorplan";
import { FLOORS, DEFAULT_FLOOR } from "@/lib/floors";
import { FLOOR_LAYOUTS, floorOfRoom, canonicalRoomKey } from "@/lib/floor-layouts";
import CategoryFilter from "@/components/CategoryFilter";
import { subjectsByUse } from "@/lib/subjects";
import FloorMap, { type MapRoom } from "@/components/FloorMap";
import { RatingStarsReadonly } from "@/components/RatingStars";
import type { Project } from "@/lib/types";

type RoomGroup = { key: string; label: string; projects: Project[] };

export default function ExplorePage() {
  const { isBadgeCollected, lastScan, clearLastScan } = useVisitor();
  const { projects, locations, categories, getAggregate, loading } = useProjectData();
  const [floor, setFloor] = useState<number>(DEFAULT_FLOOR);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null); // project the student came here from
  const handledLink = useRef(false);
  const startedAtHere = useRef(false);
  const floorplanUrl = useFloorplan(floor);

  // Every room that has projects, with its projects.
  const groups = useMemo(() => {
    const locationsById = new Map(locations.map((l) => [l.id, l]));
    const byKey = new Map<string, RoomGroup>();
    for (const p of projects) {
      if (categoryFilter && p.categoryId !== categoryFilter) continue;
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

  // "Open in Map" on a project page links here with ?project=<slug>: show that project's floor and pick its room.
  useEffect(() => {
    if (handledLink.current || projects.length === 0 || locations.length === 0) return;
    handledLink.current = true;
    const slug = new URLSearchParams(window.location.search).get("project");
    const project = slug ? projects.find((p) => p.slug === slug) : undefined;
    const room = project ? locations.find((l) => l.id === project.locationId)?.room?.trim() : undefined;
    if (!project || !room) return;
    const key = canonicalRoomKey(room);
    const onFloor = floorOfRoom(key);
    if (onFloor !== null) setFloor(onFloor);
    setCategoryFilter(null);
    setSelectedKey(key);
    setFocusId(project.id);
    window.setTimeout(() => document.getElementById("room-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 400);
  }, [projects, locations]);

  // Where the student is: the room of the project whose QR code they scanned most recently.
  const here = useMemo(() => {
    if (!lastScan) return null;
    const project = projects.find((p) => p.id === lastScan.projectId);
    const room = project ? locations.find((l) => l.id === project.locationId)?.room?.trim() : undefined;
    if (!project || !room) return null;
    const key = canonicalRoomKey(room);
    return { key, room, floor: floorOfRoom(key), projectName: project.name, at: lastScan.at };
  }, [lastScan, projects, locations]);

  // Open on the floor they are on (unless they came from an "Open in Map" link, which picks its own floor).
  useEffect(() => {
    if (startedAtHere.current || !here || here.floor === null) return;
    startedAtHere.current = true;
    if (new URLSearchParams(window.location.search).get("project")) return;
    setFloor(here.floor);
  }, [here]);

  const subjectList = useMemo(() => subjectsByUse(categories, projects), [categories, projects]);

  const mapRooms: MapRoom[] = (FLOOR_LAYOUTS[floor] ?? []).map((room) => ({ ...room, count: groups.get(room.key)?.projects.length ?? 0 }));
  const floorCount = (id: number) => (FLOOR_LAYOUTS[id] ?? []).reduce((n, room) => n + (groups.get(room.key)?.projects.length ?? 0), 0);
  const otherRooms = Array.from(groups.values())
    .filter((g) => floorOfRoom(g.key) === null)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const selected = selectedKey ? groups.get(selectedKey) : undefined;
  const floorInfo = FLOORS.find((f) => f.id === floor) ?? FLOORS[0];

  /** Picks a room; on phones and tablets the project list is below the map, so scroll down to it. */
  function selectRoom(key: string) {
    setSelectedKey(key);
    if (window.innerWidth < 1024) {
      window.setTimeout(() => document.getElementById("room-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }

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
        <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-line p-1 sm:gap-1 [scrollbar-width:none] dark:border-white/10 [&::-webkit-scrollbar]:hidden">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              onClick={() => changeFloor(f.id)}
              className={clsx(
                "shrink-0 rounded-full px-1.5 py-1.5 text-[11px] font-semibold min-[380px]:px-2 sm:px-3 sm:text-xs",
                floor === f.id ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60"
              )}
            >
              <span className="sm:hidden">{f.short}</span>
              <span className="hidden sm:inline">{f.label}</span>
              {floorCount(f.id) > 0 && <span className="ml-0.5 text-[10px] opacity-60 sm:ml-1 sm:text-xs">({floorCount(f.id)})</span>}
              {here?.floor === f.id && <span className="ml-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "#E11D2E" }} title="You are on this floor" />}
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
          <div className="relative overflow-hidden rounded-xl2 border border-line bg-white shadow-card dark:border-white/10 dark:bg-white/5">
            <FloorMap
              imageUrl={floorplanUrl}
              floorLabel={floorInfo.label}
              rooms={mapRooms}
              selectedKey={selectedKey}
              onSelect={selectRoom}
              hereKey={here && here.floor === floor ? here.key : null}
            />
            {categoryFilter && floorCount(floor) === 0 && (
              <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-night/75 p-4 text-center backdrop-blur-[1px]">
                <p className="font-display text-xl font-bold md:text-2xl">No results found on this floor</p>
                <p className="text-sm text-paper/70">Try another floor — tabs with matching projects show a number.</p>
              </div>
            )}
          </div>

          {here && (
            <div className="flex items-center justify-between gap-3 rounded-xl2 border border-red-500/40 bg-white/5 p-3 text-sm shadow-card" style={{ borderColor: "rgba(225,29,46,0.5)" }}>
              <p>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#E11D2E" }} />
                {here.floor !== null ? (
                  <>
                    You’re in <strong>{here.room}</strong> (you scanned {here.projectName}).
                    {here.floor !== floor && (
                      <button type="button" onClick={() => changeFloor(here.floor as number)} className="ml-2 underline">
                        Show my floor
                      </button>
                    )}
                  </>
                ) : (
                  <>Your last scan was in <strong>{here.room}</strong>, which isn’t on these floor plans.</>
                )}
              </p>
              <button type="button" onClick={clearLastScan} className="shrink-0 text-xs text-paper/60 underline">
                Hide
              </button>
            </div>
          )}

          {mapRooms.some((r) => r.count > 0) && (
            <div className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
              <h2 className="font-display text-sm font-semibold">Rooms with projects on the {floorInfo.short.toLowerCase()} floor</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {mapRooms
                  .filter((r) => r.count > 0)
                  .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
                  .map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => selectRoom(r.key)}
                      aria-pressed={selectedKey === r.key}
                      className={clsx(
                        "rounded-full border px-3 py-1.5 text-sm font-medium",
                        selectedKey === r.key ? "border-gold bg-gold/30" : "border-line dark:border-white/15"
                      )}
                    >
                      {r.label} <span className="font-mono text-xs opacity-60">{r.count}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {otherRooms.length > 0 && (
            <div className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
              <h2 className="font-display text-sm font-semibold">Rooms not shown on these floor plans</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {otherRooms.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => selectRoom(g.key)}
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
        <div id="room-panel" className="panel-scroll scroll-mt-20 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
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
                        className={clsx(
                          "flex items-center gap-3 rounded-xl border p-3 hover:bg-mist dark:hover:bg-white/10",
                          focusId === p.id ? "border-gold bg-gold/10 ring-1 ring-gold" : "border-line dark:border-white/10"
                        )}
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
