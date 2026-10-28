import type { Achievement, Project, VisitorStats } from "./types";

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-discovery", name: "First Discovery", description: "Scan your first project.", icon: "sparkle", check: (s) => s.projectsExplored >= 1 },
  { id: "science-explorer", name: "Science Explorer", description: "Discover 10 projects.", icon: "compass", check: (s) => s.projectsExplored >= 10 },
  { id: "deep-explorer", name: "Deep Explorer", description: "Discover 25 projects.", icon: "map", check: (s) => s.projectsExplored >= 25 },
  { id: "khoj-master", name: "Khoj Master", description: "Discover every project.", icon: "trophy", check: (s) => s.totalProjects > 0 && s.projectsExplored >= s.totalProjects },
  { id: "curious-mind", name: "Curious Mind", description: "Visit 5 different categories.", icon: "lightbulb", check: (s) => s.categoriesVisited >= 5 },
  { id: "peoples-scientist", name: "People's Scientist", description: "Rate 10 projects.", icon: "star", check: (s) => s.projectsRated >= 10 },
];

export function computeStats(
  badges: { projectId: string }[],
  ratings: { projectId: string }[],
  projectList: Project[]
): VisitorStats {
  const existing = new Set(projectList.map((p) => p.id));
  const exploredIds = new Set(badges.map((b) => b.projectId).filter((id) => existing.has(id)));
  const categories = new Set(
    Array.from(exploredIds)
      .map((id) => projectList.find((p) => p.id === id)?.categoryId)
      .filter(Boolean)
  );
  return {
    projectsExplored: exploredIds.size,
    projectsRated: new Set(ratings.map((r) => r.projectId).filter((id) => existing.has(id))).size,
    categoriesVisited: categories.size,
    totalProjects: projectList.length,
  };
}
