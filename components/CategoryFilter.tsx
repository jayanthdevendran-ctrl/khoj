"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

type Subject = { id: string; name: string; count?: number };

/**
 * Row of subject chips. It scrolls sideways, and says so: a visible scroll bar, "‹ ›" buttons on
 * laptops, and the mouse wheel / trackpad scroll the row too.
 */
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
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    update();
    const onWheel = (e: WheelEvent) => {
      // A normal up/down mouse wheel scrolls the row sideways while the pointer is over it.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return; // let the page scroll normally once the row has reached its end
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [update, categories.length]);

  const nudge = (direction: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * Math.max(220, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={scroller} className="chip-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
        <Chip label={allLabel} isActive={active === null} onClick={() => onChange(null)} />
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} count={c.count} isActive={active === c.id} onClick={() => onChange(c.id)} />
        ))}
      </div>
      {canLeft && (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Scroll subjects left"
          title="Scroll left"
          className="absolute left-0 top-0 hidden h-[2.35rem] w-9 items-center justify-center rounded-full bg-night text-2xl font-bold leading-none text-gold shadow-card ring-1 ring-gold/70 hover:bg-gold hover:text-ink md:flex"
        >
          ‹
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="Scroll subjects right"
          title="Scroll right for more subjects"
          className="absolute right-0 top-0 hidden h-[2.35rem] w-9 items-center justify-center rounded-full bg-night text-2xl font-bold leading-none text-gold shadow-card ring-1 ring-gold/70 hover:bg-gold hover:text-ink md:flex"
        >
          ›
        </button>
      )}
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
        isActive ? "border-gold bg-gold text-ink" : "border-white/15 text-paper/75 hover:bg-white/10"
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 font-mono text-xs opacity-60">{count}</span>}
    </button>
  );
}
