"use client";

import Link from "next/link";
import clsx from "clsx";
import { SHOWS, hasStarted, countdown, formatShowTime, minutesSinceMidnight, nextGroup, upcomingSlots, useNow, useShowProjects } from "@/lib/shows";

export default function ShowsPage() {
  const now = useNow();
  const info = useShowProjects();

  if (!now) return null;
  const nowMin = minutesSinceMidnight(now);
  const upcoming = upcomingSlots(nowMin);
  const group = nextGroup(nowMin);
  const clock = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Live shows</h1>
      <p className="mt-1 text-sm text-paper/60">It’s {clock} now. Times update on their own.</p>

      {/* Next show */}
      <div className="mt-5 rounded-xl2 border border-gold/40 bg-white/5 p-4 md:p-6">
        {group ? (
          <>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Next {group.slots.length > 1 ? "shows" : "show"}</p>
            <h2 className="mt-1 font-display text-xl font-semibold md:text-2xl">{formatShowTime(group.slots[0]!.time)}</h2>
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
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold">No more shows today</h2>
            <p className="mt-1 text-sm text-paper/70">All of today’s shows have finished.</p>
          </>
        )}
      </div>

      {/* Upcoming list */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Coming up today</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-paper/60">Nothing left today.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/10 rounded-xl2 border border-white/10 bg-white/5">
            {upcoming.map((s) => (
              <li key={`${s.show.key}-${s.time}`} className="flex items-center gap-3 px-4 py-3">
                <span className="w-24 shrink-0 font-mono text-sm text-gold">{formatShowTime(s.time)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.show.title}</span>
                  <span className="block text-xs text-paper/60">
                    Show {s.number}
                    {info[s.show.key]?.room ? ` · ${info[s.show.key]?.room}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-paper/70">{countdown(s.start - nowMin)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Full schedule */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Full schedule</h2>
        <div className="mt-2 space-y-3">
          {SHOWS.map((show) => {
            const slug = info[show.key]?.project?.slug;
            const nextForShow = upcomingSlots(nowMin).find((s) => s.show.key === show.key);
            return (
              <div key={show.key} className="rounded-xl2 border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-semibold">{show.title}</h3>
                    {info[show.key]?.room && <p className="text-xs text-paper/60">📍 {info[show.key]?.room}</p>}
                  </div>
                  {slug && (
                    <Link href={`/explore?project=${encodeURIComponent(slug)}`} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold">
                      Find it on the map
                    </Link>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {show.times.map((t, i) => {
                    const done = hasStarted(t, nowMin);
                    const isNext = nextForShow?.time === t;
                    return (
                      <span
                        key={t}
                        className={clsx(
                          "rounded-full border px-3 py-1.5 text-xs font-medium",
                          isNext ? "border-gold bg-gold text-ink" : done ? "border-white/10 text-paper/35 line-through" : "border-white/25"
                        )}
                      >
                        Show {i + 1}: {formatShowTime(t)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
