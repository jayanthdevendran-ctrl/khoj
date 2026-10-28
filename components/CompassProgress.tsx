"use client";

import { useEffect, useRef, useState } from "react";
import { cardinal, useCompassHeading } from "@/lib/useCompassHeading";

/**
 * Progress ring + a working compass.
 *  - The gold ring shows how many projects are done (value / total).
 *  - The dial inside turns with the phone, so the red "N" always points to real north, and the
 *    marker at the top of the dial shows the direction the phone is facing.
 */
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
  const { heading, needsPermission, denied, noSensor, requestPermission } = useCompassHeading();

  // Keep turning the short way round instead of spinning back from 359° to 1°.
  const shown = useRef(0);
  const [dial, setDial] = useState(0);
  useEffect(() => {
    if (heading == null) return;
    const target = -heading;
    let diff = ((target - shown.current) % 360 + 540) % 360 - 180;
    shown.current += diff;
    setDial(shown.current);
  }, [heading]);

  const letters: { text: string; angle: number; red?: boolean }[] = [
    { text: "N", angle: 0, red: true },
    { text: "E", angle: 90 },
    { text: "S", angle: 180 },
    { text: "W", angle: 270 },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-40 w-40 items-center justify-center">
        {/* Progress ring (stays still) */}
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

        {/* Compass dial (turns with the phone) */}
        <svg viewBox="0 0 120 120" className="absolute h-full w-full">
          <g transform={`rotate(${dial} 60 60)`} style={{ transition: "transform 120ms linear" }}>
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = i * 10;
              const major = i % 9 === 0;
              return (
                <line
                  key={i}
                  x1="60"
                  y1={major ? "13" : "16"}
                  x2="60"
                  y2="20"
                  stroke="currentColor"
                  className="text-paper/35"
                  strokeWidth={major ? 1.6 : 0.9}
                  transform={`rotate(${angle} 60 60)`}
                />
              );
            })}
            {letters.map((l) => (
              <g key={l.text} transform={`rotate(${l.angle} 60 60)`}>
                <text
                  x="60"
                  y="33"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  className={l.red ? "fill-coral" : "fill-paper/70"}
                  transform={`rotate(${-l.angle - dial} 60 30)`}
                  style={{ transition: "transform 120ms linear" }}
                >
                  {l.text}
                </text>
              </g>
            ))}
            {/* Needle: red end points north, grey end points south */}
            <polygon points="60,38 64.5,60 55.5,60" className="fill-coral" />
            <polygon points="60,82 64.5,60 55.5,60" className="fill-paper/35" />
            <circle cx="60" cy="60" r="3" className="fill-paper" />
          </g>
          {/* Fixed marker: the direction the phone is facing */}
          <polygon points="60,3 55.5,11 64.5,11" className="fill-paper" />
        </svg>
      </div>

      {/* Count */}
      <p className="font-display text-lg font-bold leading-none">
        {value}
        <span className="font-mono text-xs font-normal text-paper/60"> / {total} {label ?? "found"}</span>
      </p>

      {/* Status line */}
      <div className="h-5 text-center text-xs">
        {heading != null ? (
          <span className="font-mono text-paper/80">
            Facing {cardinal(heading)} · {Math.round(heading)}°
          </span>
        ) : needsPermission ? (
          <button
            type="button"
            onClick={() => void requestPermission()}
            className="rounded-full border border-gold/60 px-3 py-0.5 text-[11px] font-semibold text-gold"
          >
            {denied ? "Compass blocked — tap to retry" : "Tap to turn on compass"}
          </button>
        ) : noSensor ? (
          <span className="text-paper/45">Compass works on phones</span>
        ) : (
          <span className="text-paper/45">Looking for compass…</span>
        )}
      </div>
    </div>
  );
}
