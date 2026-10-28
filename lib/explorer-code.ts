/** Short public code for an account, e.g. "KHOJ-3F9A1C". Matches the explorer_ranking view. */
export function explorerCode(id: string): string {
  if (!id) return "";
  if (/^KHOJ-/i.test(id)) return id.toUpperCase();
  return `KHOJ-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
