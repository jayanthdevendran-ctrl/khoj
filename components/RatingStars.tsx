"use client";

import { useState } from "react";
import clsx from "clsx";

export function RatingStarsReadonly({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "text-sm" : "text-lg";
  return (
    <span className={clsx("font-mono text-gold-deep dark:text-gold", dim)} aria-hidden>
      {"★".repeat(Math.round(value))}
      <span className="text-line dark:text-white/20">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export function RatingStarsInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (value: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div>
      <div role="radiogroup" aria-label="Rate this project" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setSelected(n)}
            className={clsx(
              "text-3xl transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40",
              (hover ?? selected ?? 0) >= n ? "text-gold" : "text-line dark:text-white/20"
            )}
          >
            ★
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!selected || disabled}
        onClick={() => selected && onSubmit(selected)}
        className="mt-4 w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper transition-opacity disabled:opacity-30 dark:bg-paper dark:text-ink md:w-auto"
      >
        Submit Rating
      </button>
    </div>
  );
}
