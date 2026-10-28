import type { Project } from "./types";

/** Every subject a project belongs to: its main subject first, then the interconnected ones. */
export function projectSubjectIds(p: Pick<Project, "categoryId" | "relatedCategoryIds">): string[] {
  return [p.categoryId, ...p.relatedCategoryIds.filter((id) => id !== p.categoryId)];
}

/** True when the project involves ALL of the selected subjects (main or interconnected). */
export function matchesAllSubjects(p: Pick<Project, "categoryId" | "relatedCategoryIds">, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const ids = projectSubjectIds(p);
  return selected.every((s) => ids.includes(s));
}

import type { Category } from "./types";

/** Subjects ordered by how many projects involve them (most used first), with that count. */
export function subjectsByUse(categories: Category[], projects: Pick<Project, "categoryId" | "relatedCategoryIds">[]): (Category & { count: number })[] {
  const counts = new Map<string, number>();
  for (const p of projects) for (const id of projectSubjectIds(p)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return categories
    .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
