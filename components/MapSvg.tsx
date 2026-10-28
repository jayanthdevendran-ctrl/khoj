"use client";

import clsx from "clsx";
import type { Project, PointOfInterest, Location } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────
// If `floorplanUrl` is provided, it's drawn as the background image; otherwise
// a plain background is shown. Project/POI markers still
// use the same 0–100 `Location.node.x/y` grid either way, so uploading a
// real floorplan (see components/FloorplanUploader.tsx) doesn't require
// touching marker data — just make sure the uploaded image's bounds line up
// with that same 0–100 grid (see the uploader's tip text).
// ─────────────────────────────────────────────────────────────────────────

const POI_GLYPH: Record<string, string> = {
  food: "🍽️",
  restroom: "🚻",
  help: "❓",
  "first-aid": "✚",
  entrance: "➜",
  stairs: "▲",
  lift: "⬍",
};

const CATEGORY_DOT: Record<string, string> = {
  gold: "fill-gold",
  teal: "fill-teal",
  indigo: "fill-indigo",
  coral: "fill-coral",
};

export default function MapSvg({
  floor,
  projects,
  pois,
  locationsById,
  categoryColorByProjectId,
  selectedProjectId,
  onSelectProject,
  floorplanUrl,
}: {
  floor: number;
  projects: Project[];
  pois: PointOfInterest[];
  locationsById: Record<string, Location>;
  categoryColorByProjectId: Record<string, string>;
  selectedProjectId?: string | null;
  onSelectProject: (project: Project) => void;
  /** Public URL of an uploaded real floorplan for this floor, if any. */
  floorplanUrl?: string | null;
}) {
  const floorProjects = projects.filter((p) => locationsById[p.locationId]?.floor === floor);
  const floorPois = pois.filter((p) => locationsById[p.locationId]?.floor === floor);

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full select-none" role="img" aria-label={`KHOJ floor plan, ${floor === 2 ? "third" : floor === 0 ? "ground" : "floor " + (floor + 1)} floor`}>
      {/* Background */}
      {floorplanUrl ? (
        <image href={floorplanUrl} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />
      ) : (
        <rect x="0" y="0" width="100" height="100" className="fill-mist dark:fill-white/5" rx="2" />
      )}

      {/* Points of interest */}
      {floorPois.map((poi) => {
        const node = locationsById[poi.locationId]?.node;
        if (!node) return null;
        return (
          <g key={poi.id} transform={`translate(${node.x} ${node.y})`}>
            <circle r="2.6" className="fill-white stroke-ink/20 dark:fill-ink dark:stroke-paper/20" strokeWidth="0.3" />
            <text textAnchor="middle" dominantBaseline="central" style={{ fontSize: "3px" }}>
              {POI_GLYPH[poi.kind] ?? "•"}
            </text>
          </g>
        );
      })}

      {/* Project markers */}
      {floorProjects.map((project) => {
        const node = locationsById[project.locationId]?.node;
        if (!node) return null;
        const isSelected = selectedProjectId === project.id;
        const colorKey = categoryColorByProjectId[project.id] ?? "indigo";
        return (
          <g
            key={project.id}
            transform={`translate(${node.x} ${node.y})`}
            className="cursor-pointer"
            onClick={() => onSelectProject(project)}
            tabIndex={0}
            role="button"
            aria-label={`${project.name}, project ${project.projectNumber}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectProject(project);
            }}
          >
            {isSelected && (
              <circle r="4.5" className={clsx("opacity-40", CATEGORY_DOT[colorKey])} style={{ animation: "pulse-ring 1.8s ease-out infinite" }} />
            )}
            <circle
              r={isSelected ? "3.2" : "2.6"}
              className={clsx(CATEGORY_DOT[colorKey], "stroke-white dark:stroke-night")}
              strokeWidth="0.5"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white font-mono font-semibold"
              style={{ fontSize: "2.2px" }}
            >
              {project.projectNumber}
            </text>
          </g>
        );
      })}


    </svg>
  );
}
