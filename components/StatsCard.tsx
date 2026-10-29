export default function StatsCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50 dark:text-paper/50">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink/40 dark:text-paper/40">{hint}</p>}
    </div>
  );
}
