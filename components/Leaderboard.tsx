import clsx from "clsx";

const MEDALS = ["🥇", "🥈", "🥉"];

export type LeaderboardRow = {
  key: string;
  rank: number;
  title: string;
  subtitle?: string;
  value: string;
  highlight?: boolean;
};

export default function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <ol className="divide-y divide-line rounded-xl2 border border-line bg-white shadow-card dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
      {rows.map((row) => (
        <li
          key={row.key}
          className={clsx(
            "flex items-center gap-3 px-4 py-3",
            row.highlight && "bg-gold-soft/30 dark:bg-gold-deep/10"
          )}
        >
          <span className="w-8 shrink-0 text-center font-mono text-sm text-ink/50 dark:text-paper/50">
            {row.rank <= 3 ? MEDALS[row.rank - 1] : row.rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">{row.title}</p>
            {row.subtitle && <p className="truncate text-xs text-ink/50 dark:text-paper/50">{row.subtitle}</p>}
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold text-teal-deep dark:text-teal-soft">
            {row.value}
          </span>
        </li>
      ))}
    </ol>
  );
}
