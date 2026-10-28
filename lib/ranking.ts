// People's Choice ranking
//
// A naive raw average unfairly lets a project with 2 five-star ratings beat one
// with 500 ratings averaging 4.8. We use a Bayesian / "weighted rating" formula,
// the same family used by IMDb's Top 250 and similar ranked lists.
//
// score = (v / (v + m)) * R  +  (m / (v + m)) * C
//
//   R = raw average rating of the project
//   v = number of ratings the project has received
//   m = minimum votes threshold before a project's own rating counts fully
//       (raise this if visitors are voting in very small numbers; lower it
//       once KHOJ has a lot of ratings flowing in)
//   C = the mean rating across all active projects ("what an average project scores")
//
// Tune RANKING_CONFIG below. Nothing else in the app needs to change.

export const RANKING_CONFIG = {
  minVotesThreshold: 8,
};

export type Ratable = { average: number; count: number };

export function weightedScore(
  project: Ratable,
  allProjects: Ratable[],
  m: number = RANKING_CONFIG.minVotesThreshold
): number {
  const rated = allProjects.filter((p) => p.count > 0);
  const totalRatingSum = rated.reduce((sum, p) => sum + p.average * p.count, 0);
  const totalCount = rated.reduce((sum, p) => sum + p.count, 0);
  const C = totalCount > 0 ? totalRatingSum / totalCount : 0;

  const { average: R, count: v } = project;
  if (v === 0) return 0;
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

export function rankProjects<T extends Ratable>(projects: T[]): (T & { score: number })[] {
  return projects
    .map((p) => ({ ...p, score: weightedScore(p, projects) }))
    .sort((a, b) => b.score - a.score);
}
