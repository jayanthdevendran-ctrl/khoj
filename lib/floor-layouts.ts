// Clickable room areas for each floor plan image, as percentages of the image
// (x, y = top-left corner; w, h = size). They were measured from the three
// floor plan images, so if a floor plan is replaced with a differently drawn
// one, these need updating.

export type RoomRect = { key: string; label: string; x: number; y: number; w: number; h: number };

/** "AV Room", "av  room" and "AV-ROOM" all become "avroom". */
export function roomKey(room: string): string {
  return room.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Names used in the Excel sheet that differ from the label on the floor plan.
 * "Electives Room" and "Language Room" are the rooms marked Electives 1 and
 * Lang Room / Electives 2 on the second floor plan.
 */
const ROOM_ALIASES: Record<string, string> = {
  electivesroom: "electives1",
  languageroom: "langroomelectives2",
};

/** Key used to group projects by room: the normalised name, mapped to the floor plan's label if it differs. */
export function canonicalRoomKey(room: string): string {
  const key = roomKey(room);
  return ROOM_ALIASES[key] ?? key;
}

// Rectangles were measured on 1280 x 720 versions of the plans.
const W = 1280;
const H = 720;
function r(label: string, x1: number, y1: number, x2: number, y2: number): RoomRect {
  return {
    key: roomKey(label),
    label,
    x: (x1 / W) * 100,
    y: (y1 / H) * 100,
    w: ((x2 - x1) / W) * 100,
    h: ((y2 - y1) / H) * 100,
  };
}

export const FLOOR_LAYOUTS: Record<number, RoomRect[]> = {
  // Ground floor
  0: [
    r("AV Room", 32, 37, 455, 162),
    r("12C", 32, 500, 222, 682),
    r("12A", 228, 545, 375, 682),
    r("Comp Lab", 875, 545, 1105, 682),
  ],
  // First floor
  1: [
    r("Artroom", 20, 25, 470, 137),
    r("2C", 477, 25, 625, 137),
    r("2A", 632, 25, 810, 137),
    r("1D", 817, 25, 952, 137),
    r("1C", 959, 25, 1100, 137),
    r("1B", 1107, 25, 1262, 137),
    r("3B", 20, 143, 192, 308),
    r("3A", 20, 316, 192, 486),
    r("2D", 288, 203, 470, 300),
    r("2B", 706, 203, 850, 300),
    r("1A", 903, 203, 1050, 300),
    r("Library", 198, 550, 1130, 672),
  ],
  // Second floor
  2: [
    r("3C", 35, 37, 192, 150),
    r("Math Lab", 199, 37, 558, 150),
    r("10C", 35, 157, 190, 308),
    r("10B", 35, 316, 190, 468),
    r("Activity Room", 285, 203, 462, 303),
    r("11C", 708, 203, 858, 303),
    r("Lang Room / Electives 2", 906, 203, 1058, 303),
    r("11B", 1122, 292, 1246, 394),
    r("11A", 1122, 401, 1246, 494),
    r("10A", 198, 537, 353, 668),
    r("9C", 360, 537, 500, 668),
    r("9B", 507, 537, 654, 668),
    r("Electives 1", 659, 537, 806, 668),
    r("9A", 812, 537, 957, 668),
    r("12B", 963, 537, 1112, 668),
  ],
  // Third floor
  3: [
    r("Auditorium", 585, 25, 1258, 272),
    r("6D", 22, 152, 176, 320),
    r("7D", 22, 325, 176, 492),
    r("6C", 262, 203, 442, 297),
    r("7C", 180, 535, 322, 678),
    r("7B", 327, 535, 475, 678),
    r("7A", 480, 535, 630, 678),
    r("8C", 636, 535, 782, 678),
    r("8B", 788, 535, 938, 678),
    r("8A", 944, 535, 1112, 678),
    r("Music Room", 1118, 395, 1257, 502),
  ],
  // Fourth floor
  4: [
    r("5C", 22, 142, 166, 305),
    r("5B", 22, 313, 166, 482),
    r("5A", 22, 488, 166, 690),
    r("6B", 176, 553, 318, 692),
    r("6A", 326, 553, 472, 692),
    r("4D", 480, 553, 620, 692),
    r("4C", 628, 553, 775, 692),
    r("4B", 782, 553, 922, 692),
    r("4A", 930, 553, 1078, 692),
    r("STEM Lab", 1124, 372, 1264, 462),
  ],
};

/** Which floor (if any) a room name belongs to. */
export function floorOfRoom(key: string): number | null {
  for (const [floor, rooms] of Object.entries(FLOOR_LAYOUTS)) {
    if (rooms.some((room) => room.key === key)) return Number(floor);
  }
  return null;
}
