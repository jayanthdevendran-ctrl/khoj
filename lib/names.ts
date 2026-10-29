/** "Pranjal Agarwal" -> "Pranjal A." — the default public leaderboard name, so full names aren't shown publicly. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  if (parts.length === 1) return cap(parts[0]!).slice(0, 24);
  const last = parts[parts.length - 1]!;
  return `${cap(parts[0]!)} ${last.charAt(0).toUpperCase()}.`.slice(0, 24);
}

/** A full name needs at least a first and a last name. */
export function isValidFullName(name: string): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every((p) => p.length >= 1) && name.trim().length >= 3;
}
