"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectData } from "@/lib/project-data";
import { rankProjects } from "@/lib/ranking";
import { useVisitor } from "@/lib/visitor-store";
import SearchBar from "@/components/SearchBar";
import { subjectsByUse } from "@/lib/subjects";
import CategoryFilter from "@/components/CategoryFilter";
import ProjectCard from "@/components/ProjectCard";

type Sort = "peoples-choice" | "number" | "name" | "location";

/** Lower-case and strip accents, so "JOSÉ" finds "Jose" (and any capitalisation matches). */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function ProjectsPage() {
  const { isBadgeCollected } = useVisitor();
  const { projects, locations, categories, loading, error, getAggregate } = useProjectData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("peoples-choice");

  // Remember the search and filters, so pressing Back from a project returns to the same list.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem("khoj:projects:filters") ?? "null");
      if (saved) {
        setQuery(String(saved.query ?? ""));
        setCategory(saved.category ?? null);
        setLocationFilter(saved.locationFilter ?? null);
        if (saved.sort) setSort(saved.sort as Sort);
      }
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem("khoj:projects:filters", JSON.stringify({ query, category, locationFilter, sort }));
    } catch {}
  }, [query, category, locationFilter, sort, restored]);
  const filtersActive = Boolean(query.trim() || category || locationFilter);
  const clearFilters = () => {
    setQuery("");
    setCategory(null);
    setLocationFilter(null);
  };

  const results = useMemo(() => {
    let list = projects.filter((p) => p.active);
    // Every word typed must appear somewhere (project, team, subject, room or a student's name), in any order and any capitalisation.
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    if (tokens.length) {
      list = list.filter((p) => {
        const category = categories.find((c) => c.id === p.categoryId)?.name ?? "";
        const location = locations.find((l) => l.id === p.locationId);
        const haystack = fold([p.name, p.team.name, p.tagline, category, location?.room, location?.building, ...p.team.members].filter(Boolean).join(" "));
        return tokens.every((t) => haystack.includes(t));
      });
    }
    if (category) list = list.filter((p) => p.categoryId === category);
    if (locationFilter) list = list.filter((p) => locations.find((l) => l.id === p.locationId)?.room === locationFilter);

    if (sort === "peoples-choice") {
      const ranked = rankProjects(list.map((p) => ({ id: p.id, ...getAggregate(p.id) })));
      const order = new Map(ranked.map((r, i) => [r.id, i]));
      list = [...list].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else if (sort === "number") {
      list = [...list].sort((a, b) => a.projectNumber - b.projectNumber);
    } else if (sort === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "location") {
      list = [...list].sort((a, b) => {
        const la = locations.find((l) => l.id === a.locationId)?.room ?? "~";
        const lb = locations.find((l) => l.id === b.locationId)?.room ?? "~";
        return la.localeCompare(lb, undefined, { numeric: true }) || a.projectNumber - b.projectNumber;
      });
    }
    return list;
  }, [projects, categories, locations, query, category, locationFilter, sort, getAggregate]);

  // When the search matches a student's name, show which student on the card.
  const studentMatches = useMemo(() => {
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    const out = new Map<string, string>();
    if (!tokens.length) return out;
    for (const p of results) {
      const member = p.team.members.find((m) => tokens.every((t) => fold(m).includes(t)));
      if (member) out.set(p.id, member);
    }
    return out;
  }, [results, query]);

  const activeProjects = projects.filter((p) => p.active);
  const roomNames = Array.from(
    new Set(activeProjects.map((p) => locations.find((l) => l.id === p.locationId)?.room).filter((r): r is string => Boolean(r)))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Discover Projects</h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">{activeProjects.length} projects in {roomNames.length} rooms.</p>

      {loading && <p className="mt-2 text-sm text-ink/50">Refreshing project data…</p>}
      {error && <p role="status" className="mt-2 text-sm text-coral">Live data could not be loaded: {error}</p>}
      <div className="mt-4 space-y-3">
        <SearchBar value={query} onChange={setQuery} placeholder="Search projects, teams, subjects or student names…" />
        <CategoryFilter active={category} onChange={setCategory} categories={subjectsByUse(categories, projects)} />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={locationFilter ?? ""}
            onChange={(e) => setLocationFilter(e.target.value || null)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
          >
            <option value="">All rooms</option>
            {roomNames.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
          >
            <option value="peoples-choice">Sort: People&apos;s Choice</option>
            <option value="number">Sort: Project #</option>
            <option value="name">Sort: Name</option>
            <option value="location">Sort: Room</option>
          </select>
          <span className="ml-auto flex items-center gap-3 text-xs text-ink/50 dark:text-paper/50">
            {results.length} result{results.length === 1 ? "" : "s"}
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="rounded-full border border-gold/60 px-3 py-1 font-semibold text-gold hover:bg-gold hover:text-ink">
                Clear filters
              </button>
            )}
          </span>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="mt-10 rounded-xl2 border border-dashed border-line p-10 text-center dark:border-white/15">
          <p className="font-display font-semibold">No projects found.</p>
          <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">Try a different search term or clear your filters.</p>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="mt-4 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <ProjectCard key={p.id} project={p} collected={isBadgeCollected(p.id)} studentMatch={studentMatches.get(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
