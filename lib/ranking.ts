// People's Choice ranking
//
// Goal: rank projects fairly using BOTH quality (the average star rating) and quantity (how many
// people rated it). A project with a single 5-star vote must not beat one that 40 people rated 4.6,
// but a project with only a few ratings should still be able to climb as more people rate it.
//
// Method: a Bayesian ("weighted") average, the same family used by IMDb's Top 250.
//
//   points = (v / (v + m)) * R  +  (m / (v + m)) * C
//
//   R = the project's own average rating            (quality)
//   v = how many ratings it has received            (quantity)
//   C = the average of ALL ratings given across KHOJ ("what a typical project scores")
//   m = how many ratings it takes before a project is judged mostly on its own average. It adapts
//       to the event: it equals the typical number of ratings per rated project, kept between 3 and
//       10. Early on (few ratings) m is small so rankings respond quickly; later it grows so one
//       lucky streak can't dominate.
//
// A project starts at the overall average (C) and moves toward its own average (R) as v grows.
// Ties are broken by more ratings, then by the higher raw average, then alphabetically.

export const RANKING_CONFIG = {
  minWeight: 3, // m never goes below this
  maxWeight: 10, // m never goes above this
  fallbackMean: 3.5, // used only if there are no ratings at all
};

export type Ratable = { average: number; count: number };
export type RankingParams = { C: number; m: number };

/** Works out C (overall mean rating) and m (ratings needed for a project to stand on its own). */
export function rankingParams(all: Ratable[]): RankingParams {
  const rated = all.filter((p) => p.count > 0);
  const totalCount = rated.reduce((sum, p) => sum + p.count, 0);
  const totalSum = rated.reduce((sum, p) => sum + p.average * p.count, 0);
  const C = totalCount > 0 ? totalSum / totalCount : RANKING_CONFIG.fallbackMean;
  const typical = rated.length > 0 ? totalCount / rated.length : 0;
  const m = Math.min(RANKING_CONFIG.maxWeight, Math.max(RANKING_CONFIG.minWeight, Math.round(typical)));
  return { C, m };
}

export function weightedScore(project: Ratable, params: RankingParams): number {
  const { average: R, count: v } = project;
  if (v <= 0) return 0;
  return (v / (v + params.m)) * R + (params.m / (v + params.m)) * params.C;
}

export function rankProjects<T extends Ratable & { id?: string }>(projects: T[]): (T & { score: number })[] {
  const params = rankingParams(projects);
  return projects
    .map((p) => ({ ...p, score: weightedScore(p, params) }))
    .sort((a, b) => b.score - a.score || b.count - a.count || b.average - a.average || String(a.id ?? "").localeCompare(String(b.id ?? "")));
}


// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL ranking system (kept for the admin dashboard, for comparison / as a fallback).
//
// No algorithm: a project's score is simply the average of its ratings, so one 5-star rating
// shows 5.00. Projects are listed by average (highest first); when averages tie, the project with
// more ratings goes first. The public Awards page uses the adaptive version above.
// ─────────────────────────────────────────────────────────────────────────────

export function rankProjectsOriginal<T extends Ratable & { id?: string }>(projects: T[]): (T & { score: number })[] {
  return projects
    .map((p) => ({ ...p, score: p.count > 0 ? p.average : 0 }))
    .sort((a, b) => b.score - a.score || b.count - a.count || String(a.id ?? "").localeCompare(String(b.id ?? "")));
}
