import { supabase } from "@/lib/supabase";
import { floorOfRoom, canonicalRoomKey } from "@/lib/floor-layouts";
import { FLOORS } from "@/lib/floors";

/** One project as needed for its QR code label. */
export type QrRow = {
  id: string;
  project_number: number;
  name: string;
  slug: string;
  active: boolean;
  teams?: { name: string } | null;
  locations?: { room: string } | null;
};

/** One printed A4 page: a room's heading and up to 8 projects. */
export type SheetPage = { room: string; title: string; floorLabel: string; rows: QrRow[]; part: number; parts: number };

export const PER_PAGE = 8; // 2 columns x 4 rows on A4
export const NO_ROOM = "No room assigned";

export function roomTitle(room: string) {
  return room === NO_ROOM ? room : /^\d/.test(room) ? `Room ${room}` : room;
}

/** The link a project's QR code opens. ?scan=1 is what unlocks rating and the passport badge. */
export function projectQrUrl(baseUrl: string, slug: string) {
  return `${baseUrl.trim().replace(/\/+$/, "")}/project/${slug}?scan=1`;
}

/** Loads every active project straight from the database, so sheets always match the current projects. */
export async function fetchQrRows(): Promise<QrRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,project_number,name,slug,active,teams(name),locations(room)")
    .eq("active", true)
    .order("project_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as QrRow[];
}

/** Groups projects by room (lowest floor first, then room name); every room starts on a new page. */
export function buildSheetPages(rows: QrRow[]): { pages: SheetPage[]; roomSummary: { room: string; count: number; pages: number }[] } {
  const byRoom = new Map<string, QrRow[]>();
  for (const r of rows) {
    const room = r.locations?.room?.trim() || NO_ROOM;
    byRoom.set(room, [...(byRoom.get(room) ?? []), r]);
  }
  const floorOf = (room: string) => (room === NO_ROOM ? null : floorOfRoom(canonicalRoomKey(room)));
  const rooms = Array.from(byRoom.keys()).sort((a, b) => {
    const fa = floorOf(a) ?? 99;
    const fb = floorOf(b) ?? 99;
    return fa - fb || a.localeCompare(b, undefined, { numeric: true });
  });
  const pages: SheetPage[] = [];
  const roomSummary: { room: string; count: number; pages: number }[] = [];
  for (const room of rooms) {
    const list = [...(byRoom.get(room) ?? [])].sort((a, b) => a.project_number - b.project_number);
    const parts = Math.max(1, Math.ceil(list.length / PER_PAGE));
    const floor = floorOf(room);
    const floorLabel = floor === null ? "" : FLOORS.find((f) => f.id === floor)?.label ?? "";
    for (let p = 0; p < parts; p++) {
      pages.push({ room, title: roomTitle(room), floorLabel, rows: list.slice(p * PER_PAGE, (p + 1) * PER_PAGE), part: p + 1, parts });
    }
    roomSummary.push({ room, count: list.length, pages: parts });
  }
  return { pages, roomSummary };
}
