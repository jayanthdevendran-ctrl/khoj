"use client";

import { useMemo, useState } from "react";
import { useProjectData } from "@/lib/project-data";
import { rankProjects } from "@/lib/ranking";
import { useVisitor } from "@/lib/visitor-store";
import SearchBar from "@/components/SearchBar";
import { projectSubjectIds, subjectsByUse } from "@/lib/subjects";
import CategoryFilter from "@/components/CategoryFilter";
import ProjectCard from "@/components/ProjectCard";

type Sort = "peoples-choice" | "number" | "name" | "location";

export default function ProjectsPage() {
  const { isBadgeCollected } = useVisitor();
  const { projects, locations, categories, loading, error, getAggregate } = useProjectData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("peoples-choice");

  const results = useMemo(() => {
    let list = projects.filter((p) => p.active);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const category = categories.find((c) => c.id === p.categoryId)?.name ?? "";
        const location = locations.find((l) => l.id === p.locationId);
        return [p.name, p.team.name, p.tagline, category, location?.room, location?.building]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q));
      });
    }
    if (category) list = list.filter((p) => projectSubjectIds(p).includes(category));
    if (locationFilter) list = list.filter((p) => locations.find((l) => l.id === p.locationId)?.building === locationFilter);

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
        const la = locations.find((l) => l.id === a.locationId)?.building ?? "";
        const lb = locations.find((l) => l.id === b.locationId)?.building ?? "";
        return la.localeCompare(lb);
      });
    }
    return list;
  }, [projects, categories, locations, query, category, locationFilter, sort, getAggregate]);

  const buildings = Array.from(new Set(locations.map((l) => l.building)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Discover Projects</h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">{projects.filter((p) => p.active).length} projects across {buildings.length} blocks.</p>

      {loading && <p className="mt-2 text-sm text-ink/50">Refreshing project data…</p>}
      {error && <p role="status" className="mt-2 text-sm text-coral">Live data could not be loaded: {error}</p>}
      <div className="mt-4 space-y-3">
        <SearchBar value={query} onChange={setQuery} />
        <CategoryFilter active={category} onChange={setCategory} categories={subjectsByUse(categories, projects)} />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={locationFilter ?? ""}
            onChange={(e) => setLocationFilter(e.target.value || null)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
          >
            <option value="">All locations</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b}
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
            <option value="location">Sort: Location</option>
          </select>
          <span className="ml-auto text-xs text-ink/50 dark:text-paper/50">{results.length} results</span>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="mt-10 rounded-xl2 border border-dashed border-line p-10 text-center dark:border-white/15">
          <p className="font-display font-semibold">No projects found.</p>
          <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">Try a different search term or clear your filters.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <ProjectCard key={p.id} project={p} collected={isBadgeCollected(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
