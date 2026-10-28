// Core domain types — mirror the Supabase schema in /supabase/schema.sql
// Keep this file as the single source of truth for shapes used across the app.

export type Category = {
  id: string;
  name: string;
  icon: string; // lucide icon name or short emoji fallback
  color: "gold" | "teal" | "indigo" | "coral";
};

export type Team = {
  id: string;
  name: string;
  logoUrl: string;
  members: string[];
};

export type MapNode = {
  id: string;
  floor: number; // 0 = ground, 1 = first, 2 = third
  x: number; // percentage 0-100 within floor plan viewBox
  y: number;
  label: string;
};

export type Location = {
  id: string;
  building: string;
  floor: number;
  room: string;
  /** false until a room has been positioned on a floor plan (older admin tooling). */
  placed?: boolean;
  node: MapNode;
};

export type ProjectKind =
  | "project"
  | "food"
  | "restroom"
  | "help"
  | "first-aid"
  | "entrance"
  | "stairs"
  | "lift";

export type Project = {
  id: string;
  projectNumber: number;
  name: string;
  slug: string;
  tagline: string;
  team: Team;
  /** Student names (also available as team.members). */
  members: string[];
  /** Extra subjects the project spans, besides categoryId. */
  relatedCategoryIds: string[];
  categoryId: string;
  locationId: string;
  about: string;
  problem: string;
  solution: string;
  impact: string;
  featured: boolean;
  active: boolean;
};

export type PointOfInterest = {
  id: string;
  kind: Exclude<ProjectKind, "project">;
  label: string;
  locationId: string;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (stats: VisitorStats) => boolean;
};

export type VisitorStats = {
  projectsExplored: number;
  projectsRated: number;
  categoriesVisited: number;
  totalProjects: number;
};

export type RatingRecord = {
  projectId: string;
  rating: number; // 1-5
  ratedAt: string;
};

export type BadgeRecord = {
  projectId: string;
  collectedAt: string;
};

export type VisitorState = {
  explorerId: string;
  displayName: string | null;
  badges: BadgeRecord[];
  ratings: RatingRecord[];
  unlockedAchievements: string[];
  lastScannedAt: string | null;
};
