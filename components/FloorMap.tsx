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
}: {
  imageUrl: string | null;
  floorLabel: string;
  rooms: MapRoom[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
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
    </div>
  );
}
