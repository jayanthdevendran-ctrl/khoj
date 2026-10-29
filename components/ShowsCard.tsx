"use client";

import Link from "next/link";
import { countdown, formatShowTime, minutesSinceMidnight, nextGroup, upcomingSlots, useNow, useShowProjects } from "@/lib/shows";

/** Home page: the next live show with a minutes countdown, and what's coming after it. */
export default function ShowsCard() {
  const now = useNow();
  const info = useShowProjects();

  if (!now) return <div className="h-40 rounded-xl2 border border-white/10 bg-white/5" aria-hidden />;

  const nowMin = minutesSinceMidnight(now);
  const group = nextGroup(nowMin);
  const later = upcomingSlots(nowMin).filter((s) => !group || s.start > group.start);

  return (
    <div className="rounded-xl2 border border-gold/40 bg-white/5 p-4 shadow-card md:p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">🎭 Live shows</p>

      {group ? (
        <>
          <h2 className="mt-2 font-display text-xl font-semibold md:text-2xl">Next {group.slots.length > 1 ? "shows" : "show"}: {formatShowTime(group.slots[0]!.time)}</h2>
          <p className="mt-2 inline-block rounded-full bg-gold px-4 py-1.5 text-sm font-bold text-ink">{countdown(group.start - nowMin)}</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {group.slots.map((s) => (
              <li key={s.show.key}>
                <span className="font-medium">{s.show.title}</span>
                <span className="text-paper/60">
                  {" "}· Show {s.number}
                  {info[s.show.key]?.room ? ` · ${info[s.show.key]?.room}` : ""}
                </span>
              </li>
            ))}
          </ul>

          {later.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold text-paper/80">Coming up</h3>
              <ul className="mt-2 divide-y divide-white/10 text-sm">
                {later.slice(0, 5).map((s) => (
                  <li key={`${s.show.key}-${s.time}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-mono text-xs text-gold">{formatShowTime(s.time)}</span>{" "}
                      <span className="font-medium">{s.show.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-paper/60">{countdown(s.start - nowMin)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <>
          <h2 className="mt-2 font-display text-xl font-semibold">No more shows today</h2>
          <p className="mt-1 text-sm text-paper/70">All of today’s shows have finished. You can still see the full schedule.</p>
        </>
      )}

      <Link href="/shows" className="mt-4 inline-block text-sm font-semibold text-gold underline">
        All show times →
      </Link>
    </div>
  );
}
