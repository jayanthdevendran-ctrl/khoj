"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectData } from "@/lib/project-data";
import type { Project } from "@/lib/types";

// Live shows at KHOJ. Edit the times here (24-hour "HH:MM"); everything else updates itself.
// Times are read as school time (India), whatever time zone the visitor's phone is set to.
export const SHOW_TIMEZONE = "Asia/Kolkata";

export type ShowDef = {
  key: string;
  title: string;
  /** Start of the project name on the site, used to find the project (and its room). */
  matchName: string;
  /** Room to show if the project can't be found on the site. */
  fallbackRoom?: string;
  times: string[];
};

export const SHOWS: ShowDef[] = [
  { key: "civilisations", title: "A Journey Through Four Civilisations", matchName: "ajourneythroughfourcivilisations", fallbackRoom: "Auditorium", times: ["09:00", "10:00", "11:00", "12:00", "13:00"] },
  { key: "case-file", title: "Case File 2026", matchName: "casefile2026", fallbackRoom: "AV Room", times: ["09:00", "10:15", "11:30", "12:45"] },
  { key: "lightening-within", title: "The Lightening Within", matchName: "thelighteningwithin", fallbackRoom: "10A", times: ["09:00", "10:00", "11:00", "12:00", "13:00"] },
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function showForProjectName(name: string): ShowDef | undefined {
  const n = normalize(name);
  return SHOWS.find((s) => n.startsWith(s.matchName));
}

/** Minutes since midnight, school time. */
export function minutesSinceMidnight(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SHOW_TIMEZONE, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

const toMinutes = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};

/** True once a show's start time has passed (school time). */
export function hasStarted(time: string, nowMinutes: number): boolean {
  return nowMinutes > toMinutes(time);
}

/** "9:00 AM", "12:00 Noon", "1:00 PM" */
export function formatShowTime(t: string): string {
  const [h = 0, m = 0] = t.split(":").map(Number);
  const mm = String(m).padStart(2, "0");
  if (h === 12 && m === 0) return "12:00 Noon";
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${suffix}`;
}

export type ShowSlot = { show: ShowDef; number: number; time: string; start: number };

export function allSlots(): ShowSlot[] {
  return SHOWS.flatMap((show) => show.times.map((time, i) => ({ show, number: i + 1, time, start: toMinutes(time) }))).sort(
    (a, b) => a.start - b.start || a.show.title.localeCompare(b.show.title)
  );
}

/** Shows that haven't started yet (or start right now), soonest first. */
export function upcomingSlots(nowMinutes: number): ShowSlot[] {
  return allSlots().filter((s) => s.start >= nowMinutes);
}

/** "starting now", "in 23 min", "in 65 min (1 h 5 min)" */
export function countdown(minutesAway: number): string {
  if (minutesAway <= 0) return "starting now";
  if (minutesAway < 60) return `in ${minutesAway} min`;
  const h = Math.floor(minutesAway / 60);
  const m = minutesAway % 60;
  return `in ${minutesAway} min (${h} h${m ? ` ${m} min` : ""})`;
}

/** Current time, refreshed every few seconds. Null until the page has loaded in the browser. */
export function useNow(intervalMs = 15000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Each show together with the project it belongs to (for its room and a map link). */
export function useShowProjects(): Record<string, { project?: Project; room?: string }> {
  const { projects, locations } = useProjectData();
  return useMemo(() => {
    const out: Record<string, { project?: Project; room?: string }> = {};
    for (const show of SHOWS) {
      const project = projects.find((p) => normalize(p.name).startsWith(show.matchName));
      const room = project ? locations.find((l) => l.id === project.locationId)?.room : undefined;
      out[show.key] = { project, room: room || show.fallbackRoom };
    }
    return out;
  }, [projects, locations]);
}

/** The soonest start time and every show that begins then (several shows can start together). */
export function nextGroup(nowMinutes: number): { slots: ShowSlot[]; start: number } | null {
  const upcoming = upcomingSlots(nowMinutes);
  const first = upcoming[0];
  if (!first) return null;
  return { start: first.start, slots: upcoming.filter((s) => s.start === first.start) };
}
