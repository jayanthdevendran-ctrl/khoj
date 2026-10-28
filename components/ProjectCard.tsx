"use client";

import Link from "next/link";
import type { Project } from "@/lib/types";
import { useProjectData } from "@/lib/project-data";
import { RatingStarsReadonly } from "./RatingStars";

export default function ProjectCard({ project, collected }: { project: Project; collected?: boolean }) {
  const { categories, locations, getAggregate } = useProjectData();
  const category = categories.find((c) => c.id === project.categoryId);
  const location = locations.find((l) => l.id === project.locationId);
  const agg = getAggregate(project.id);

  return (
    <Link
      href={`/project/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl2 border border-line bg-white shadow-card transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line/70 bg-mist/50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <span className="font-mono text-xs text-ink/50 dark:text-paper/50">
          #{String(project.projectNumber).padStart(2, "0")}
        </span>
        {collected && (
          <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-deep dark:text-teal-soft">
            Collected
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {project.team.logoUrl && <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-white p-2 dark:bg-white/5"><img src={project.team.logoUrl} alt={`${project.team.name} logo`} className="max-h-full max-w-full object-contain" loading="lazy" /></div>}
        <div className="w-fit text-[11px] font-semibold uppercase tracking-wide">
          <CategoryPill categoryId={project.categoryId} />
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-teal-deep dark:group-hover:text-teal-soft">
          {project.name}
        </h3>
        {project.tagline && <p className="text-sm text-ink/70 dark:text-paper/70">{project.tagline}</p>}
        <div className="mt-auto flex items-center justify-between pt-3 text-sm">
          <span className="text-ink/60 dark:text-paper/60">{location?.room ? `📍 ${location.room}` : ""}</span>
          <span className="flex items-center gap-1">
            <RatingStarsReadonly value={agg.average} />
            <span className="font-mono text-xs text-ink/50 dark:text-paper/50">({agg.count})</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function CategoryPill({ categoryId }: { categoryId: string }) {
  const { categories } = useProjectData();
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;
  const colorMap: Record<string, string> = {
    gold: "bg-gold-soft text-gold-deep",
    teal: "bg-teal-soft text-teal-deep",
    indigo: "bg-indigo-soft text-indigo-deep",
    coral: "bg-coral-soft text-coral",
  };
  return <span className={`rounded-full px-2.5 py-0.5 ${colorMap[category.color]}`}>{category.name}</span>;
}
