"use client";

import { useState } from "react";
import clsx from "clsx";
import type { RoomRect } from "@/lib/floor-layouts";

export type MapRoom = RoomRect & { count: number };

/**
 * Shows a floor plan image at its own proportions (never cropped) with a
 * clickable area over each room. Rooms that hold projects are highlighted and
 * show how many there are.
 */
export default function FloorMap({
  imageUrl,
  floorLabel,
  rooms,
  selectedKey,
  onSelect,
  hereKey = null,
}: {
  imageUrl: string | null;
  floorLabel: string;
  rooms: MapRoom[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Room the student last scanned a QR code in: shown with a red person marker. */
  hereKey?: string | null;
}) {
  const [ratio, setRatio] = useState(16 / 9);

  if (!imageUrl) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center p-6 text-center text-sm text-ink/50 dark:text-paper/50">
        The {floorLabel.toLowerCase()} plan hasn’t been uploaded yet.
      </div>
    );
  }

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: String(ratio) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${floorLabel} plan`}
        draggable={false}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth && naturalHeight) setRatio(naturalWidth / naturalHeight);
        }}
        className="absolute inset-0 h-full w-full object-fill"
      />
      {rooms.map((room) => {
        const active = room.count > 0;
        const selected = selectedKey === room.key;
        return (
          <button
            key={room.key}
            type="button"
            disabled={!active}
            onClick={() => onSelect(room.key)}
            aria-label={active ? `${room.label}, ${room.count} project${room.count === 1 ? "" : "s"}` : room.label}
            aria-pressed={selected}
            style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%` }}
            className={clsx(
              "absolute rounded-sm border-2 transition-colors",
              !active && "pointer-events-none border-transparent",
              active && !selected && "border-teal/70 bg-teal/20 hover:bg-teal/35",
              selected && "border-gold bg-gold/35 ring-2 ring-gold"
            )}
          >
            {active && (
              <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-mono text-[10px] font-semibold leading-none text-paper shadow md:h-6 md:min-w-6 md:text-xs">
                {room.count}
              </span>
            )}
          </button>
        );
      })}
      {(() => {
        const room = hereKey ? rooms.find((r) => r.key === hereKey) : undefined;
        if (!room) return null;
        return (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${room.x + room.w / 2}%`, top: `${room.y + room.h / 2}%` }}
            aria-label={`You are in ${room.label}`}
          >
            <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: "#E11D2E" }} />
            <span
              className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-lg md:h-10 md:w-10"
              style={{ background: "#E11D2E" }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" fill="#fff" aria-hidden>
                <circle cx="12" cy="7" r="3.6" />
                <path d="M4.5 21c0-4.4 3.2-7.2 7.5-7.2s7.5 2.8 7.5 7.2z" />
              </svg>
            </span>
            <span
              className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ background: "#E11D2E" }}
            >
              You
            </span>
          </div>
        );
      })()}
    </div>
  );
}
