/** The floors shown on the public map and offered in the admin floor plan uploader. */
export const FLOORS = [
  { id: 0, label: "Ground Floor", short: "Ground" },
  { id: 1, label: "First Floor", short: "First" },
  { id: 2, label: "Second Floor", short: "Second" },
  { id: 3, label: "Third Floor", short: "Third" },
  { id: 4, label: "Fourth Floor", short: "Fourth" },
] as const;

export const DEFAULT_FLOOR = 2;
