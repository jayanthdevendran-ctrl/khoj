export default function CompassProgress({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - pct);
  const needleAngle = -90 + pct * 360;

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" className="text-line dark:text-white/10" strokeWidth="6" />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          className="text-gold transition-[stroke-dashoffset] duration-700 ease-out"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {/* Compass ticks */}
      <svg viewBox="0 0 120 120" className="absolute h-full w-full">
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * 360;
          const major = i % 6 === 0;
          return (
            <line
              key={i}
              x1="60"
              y1={major ? "8" : "12"}
              x2="60"
              y2="16"
              stroke="currentColor"
              className="text-ink/15 dark:text-paper/15"
              strokeWidth={major ? 1.5 : 1}
              transform={`rotate(${angle} 60 60)`}
            />
          );
        })}
        {/* Needle */}
        <g transform={`rotate(${needleAngle} 60 60)`} className="transition-transform duration-700 ease-out">
          <polygon points="60,20 64,60 60,64 56,60" className="fill-coral" />
          <polygon points="60,100 64,60 60,56 56,60" className="fill-ink/30 dark:fill-paper/30" />
        </g>
        <circle cx="60" cy="60" r="5" className="fill-ink dark:fill-paper" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-bold">{value}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink/50 dark:text-paper/50">
          / {total} {label ?? "found"}
        </span>
      </div>
    </div>
  );
}
