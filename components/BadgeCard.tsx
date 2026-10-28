"use client";

import Link from "next/link";
import clsx from "clsx";
import type { Project } from "@/lib/types";
import { useProjectData } from "@/lib/project-data";

export default function BadgeCard({
  project,
  collected,
  justCollected,
}: {
  project: Project;
  collected: boolean;
  justCollected?: boolean;
}) {
  const { categories } = useProjectData();
  const category = categories.find((c) => c.id === project.categoryId);
  const label = project.team.name || project.name;

  const content = (
    <div
      className={clsx(
        "relative flex aspect-[3/4] flex-col items-center justify-between rounded-xl2 border p-3 text-center transition-all",
        collected
          ? "border-gold/60 bg-gradient-to-b from-white to-gold-soft/40 shadow-badge dark:from-white/10 dark:to-gold-deep/20"
          : "border-dashed border-line bg-mist/40 dark:border-white/10 dark:bg-white/5",
        justCollected && "animate-badge-fly"
      )}
    >
      <span className="font-mono text-[10px] text-ink/40 dark:text-paper/40">
        #{String(project.projectNumber).padStart(2, "0")}
      </span>
      <div
        className={clsx(
          "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 text-xl font-display font-semibold",
          collected ? "border-gold bg-white text-ink dark:bg-ink dark:text-paper" : "border-line text-ink/20 dark:border-white/10 dark:text-paper/15"
        )}
        aria-hidden
      >
        {project.team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.team.logoUrl}
            alt=""
            className={clsx("h-full w-full rounded-full object-contain p-1", !collected && "opacity-25 grayscale")}
          />
        ) : (
          label.slice(0, 2).toUpperCase()
        )}
      </div>
      <div>
        <p
          className={clsx(
            "font-display text-xs font-semibold leading-tight",
            collected ? "text-ink dark:text-paper" : "text-ink/30 dark:text-paper/25"
          )}
        >
          {collected ? label : "Locked"}
        </p>
        <p className={clsx("mt-0.5 text-[10px]", collected ? "text-ink/50 dark:text-paper/50" : "text-ink/20 dark:text-paper/20")}>
          {collected ? category?.name : "Not discovered"}
        </p>
      </div>
    </div>
  );

  if (!collected) {
    return <div aria-label={`Project ${project.projectNumber}, not yet discovered`}>{content}</div>;
  }

  return (
    <Link href={`/project/${project.slug}`} aria-label={`${project.name} badge, collected`}>
      {content}
    </Link>
  );
}
