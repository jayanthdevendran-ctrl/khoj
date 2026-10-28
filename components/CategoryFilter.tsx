"use client";

import clsx from "clsx";

type Subject = { id: string; name: string; count?: number };

export default function CategoryFilter({
  active,
  onChange,
  categories,
  allLabel = "All subjects",
}: {
  active: string | null;
  onChange: (id: string | null) => void;
  categories: Subject[];
  allLabel?: string;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <Chip label={allLabel} isActive={active === null} onClick={() => onChange(null)} />
      {categories.map((c) => (
        <Chip key={c.id} label={c.name} count={c.count} isActive={active === c.id} onClick={() => onChange(c.id)} />
      ))}
    </div>
  );
}

function Chip({ label, count, isActive, onClick }: { label: string; count?: number; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={clsx(
        "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-gold bg-gold text-ink"
          : "border-white/15 text-paper/75 hover:bg-white/10"
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 font-mono text-xs opacity-60">{count}</span>}
    </button>
  );
}
