import type { Location } from "./types";

export const FLOOR_LABELS = ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Fourth Floor"];
export function floorLabel(n: number) {
  return FLOOR_LABELS[n] ?? `Floor ${n}`;
}

/** "Third Floor · 7A" — how a room is shown to visitors. */
export function placeLabel(l: Pick<Location, "floor" | "room"> | undefined | null) {
  return l ? `${floorLabel(l.floor)} · ${l.room}` : "";
}

/** Up to two initials from a project name: "Water Quality Sensor" -> "WQ". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
