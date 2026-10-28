import { readSheet } from "read-excel-file/browser";
import { supabase } from "./supabase";
import { floorLabel } from "./format";
import { SCHOOL_ROOMS } from "./school-rooms";
import type { Category, Location, Project } from "./types";

// ──────────────────────────────────────────────────────────────────────
// Excel import: one row per project.
//   Main Subject            -> the project's main subject (used for colour + sorting)
//   Interconnected Subjects -> other subjects it connects to (comma separated),
//                              so it also shows up when visitors filter by those
//   Floor + Room            -> matched to the floor plan, which places the project's pin
// Header names are matched loosely (case, spaces and punctuation ignored).
// ──────────────────────────────────────────────────────────────────────

export const TEMPLATE_HEADERS = [
  "Project Number",
  "Project Name",
  "Tagline",
  "Students",
  "Main Subject",
  "Interconnected Subjects",
  "Floor",
  "Room",
  "About",
  "Featured",
] as const;

type Field =
  | "number" | "name" | "tagline" | "members" | "category" | "related" | "building" | "floor" | "room"
  | "about" | "featured" | "x" | "y";

const ALIASES: Record<Field, string[]> = {
  number: ["projectnumber", "number", "no", "projectno", "sno", "srno", "slno", "id"],
  name: ["projectname", "name", "title", "projecttitle", "project"],
  tagline: ["tagline", "subtitle", "oneliner", "shortdescription"],
  members: ["students", "studentnames", "teammembers", "members", "names"],
  category: ["mainsubject", "primarysubject", "subject", "category", "field", "domain", "topic", "area"],
  related: ["interconnectedsubjects", "interconnectedsubject", "relatedsubjects", "relatedsubject", "othersubjects", "secondarysubjects", "alsosubjects", "connectedsubjects"],
  building: ["building", "block", "wing"],
  floor: ["floor", "level"],
  room: ["room", "roomnumber", "class", "classroom", "classname", "location", "lab", "venue", "stall"],
  about: ["about", "description", "details", "abstract", "summary"],
  featured: ["featured", "highlight", "spotlight"],
  x: ["x", "xcoordinate", "posx", "mapx"],
  y: ["y", "ycoordinate", "posy", "mapy"],
};

export type ParsedRow = {
  sheetRow: number; // 1-based row number in the spreadsheet, for error messages
  number: number;
  name: string;
  tagline: string;
  members: string[];
  categoryName: string;
  relatedNames: string[];
  building: string;
  floor: number | null; // null = not given in the sheet
  room: string;
  about: string;
  featured: boolean;
  x: number | null;
  y: number | null;
};

export type ParsedImport = {
  rows: ParsedRow[];
  errors: { row: number; message: string }[];
  warnings: string[];
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Class 7 A", "7A", "7-a" and "Room 7A" all become "7a" — so sheet names match the floor plan forgivingly. */
export function roomKey(s: string) {
  return s
    .toLowerCase()
    .replace(/^\s*(class|grade|std|standard|room|rm)\b\s*[-:.]?\s*/, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseFloor(v: unknown): number | null {
  const t = text(v).toLowerCase();
  if (!t) return null;
  if (/^(g|gf|ground|ground floor|0)$/.test(t)) return 0;
  if (/^(1|1st|first|first floor)$/.test(t)) return 1;
  if (/^(2|2nd|second|second floor)$/.test(t)) return 2;
  if (/^(3|3rd|third|third floor)$/.test(t)) return 3;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseBool(v: unknown) {
  if (typeof v === "boolean") return v;
  return /^(y|yes|true|1|x|✓)$/i.test(text(v));
}

function parseCoord(v: unknown): number | null | "bad" {
  if (v === null || v === undefined || text(v) === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return "bad";
  return n;
}

const splitList = (v: unknown) =>
  text(v)
    .split(/[,;|\n]/)
    .map((m) => m.trim())
    .filter(Boolean);

export async function parseProjectsFile(file: File, firstFreeNumber: number): Promise<ParsedImport> {
  const data = (await readSheet(file)) as unknown[][];
  const errors: ParsedImport["errors"] = [];
  const warnings: string[] = [];
  if (!data || data.length < 2) {
    return { rows: [], errors: [{ row: 1, message: "The sheet is empty (it needs a header row and at least one project)." }], warnings };
  }

  const headerRow = data[0] ?? [];
  const colOf: Partial<Record<Field, number>> = {};
  headerRow.forEach((h, i) => {
    const key = norm(h);
    (Object.keys(ALIASES) as Field[]).forEach((f) => {
      if (colOf[f] === undefined && ALIASES[f].includes(key)) colOf[f] = i;
    });
  });
  if (colOf.name === undefined) {
    return { rows: [], errors: [{ row: 1, message: 'Could not find a "Project Name" column in the first row.' }], warnings };
  }
  if (colOf.room === undefined) warnings.push('No "Room" column found — projects will be put in an "Unassigned" room until you place them.');

  const get = (row: unknown[], f: Field) => (colOf[f] === undefined ? undefined : row[colOf[f]!]);

  const rows: ParsedRow[] = [];
  const seenNumbers = new Set<number>();
  let nextAuto = firstFreeNumber;

  // Explicit numbers first, so auto-numbers never collide with them.
  data.slice(1).forEach((r) => {
    const n = Number(get(r, "number"));
    if (Number.isInteger(n) && n > 0) nextAuto = Math.max(nextAuto, n + 1);
  });

  data.slice(1).forEach((r, idx) => {
    const sheetRow = idx + 2;
    if (!r || r.every((c) => text(c) === "")) return; // skip blank lines
    const name = text(get(r, "name"));
    if (!name) {
      errors.push({ row: sheetRow, message: "Missing project name." });
      return;
    }
    let number = Number(get(r, "number"));
    if (!Number.isInteger(number) || number <= 0) number = nextAuto++;
    if (seenNumbers.has(number)) {
      errors.push({ row: sheetRow, message: `Project number ${number} appears more than once in the sheet.` });
      return;
    }
    seenNumbers.add(number);

    const x = parseCoord(get(r, "x"));
    const y = parseCoord(get(r, "y"));
    if (x === "bad" || y === "bad") {
      errors.push({ row: sheetRow, message: "X and Y must be numbers between 0 and 100 (or left blank)." });
      return;
    }

    const categoryName = text(get(r, "category")) || "Other";
    const seenSubjects = new Set([categoryName.toLowerCase()]);
    const relatedNames = splitList(get(r, "related")).filter((n) => !seenSubjects.has(n.toLowerCase()) && seenSubjects.add(n.toLowerCase()));

    rows.push({
      sheetRow,
      number,
      name,
      tagline: text(get(r, "tagline")),
      members: splitList(get(r, "members")),
      categoryName,
      relatedNames,
      building: text(get(r, "building")) || "Main Building",
      floor: parseFloor(get(r, "floor")),
      room: text(get(r, "room")) || "Unassigned",
      about: text(get(r, "about")),
      featured: parseBool(get(r, "featured")),
      x: x !== null && y !== null ? x : null,
      y: x !== null && y !== null ? y : null,
    });
  });

  return { rows, errors, warnings };
}

// ── What's already in the database ─────────────────────────────────────────

export type ExistingData = {
  categories: { id: string; name: string }[];
  locations: { id: string; building: string; floor: number; room: string }[];
  projectNumbers: number[];
};

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/** Reads the real database state, so previews and imports never depend on what the page happened to load. */
export async function loadExisting(): Promise<ExistingData> {
  const [c, l, p] = await Promise.all([
    supabase.from("categories").select("id,name"),
    supabase.from("locations").select("id,building,floor,room"),
    supabase.from("projects").select("project_number"),
  ]);
  check(c.error, "Reading subjects");
  check(l.error, "Reading rooms");
  check(p.error, "Reading projects");
  return {
    categories: (c.data ?? []) as ExistingData["categories"],
    locations: (l.data ?? []) as ExistingData["locations"],
    projectNumbers: (p.data ?? []).map((r: any) => r.project_number as number),
  };
}

/** Finds the floor-plan room a sheet row refers to. With no floor given, the room name must be unique. */
export function findLocation(locs: ExistingData["locations"], floor: number | null, room: string) {
  const key = roomKey(room);
  if (!key) return null;
  const same = locs.filter((l) => roomKey(l.room) === key);
  if (floor !== null) return same.find((l) => l.floor === floor) ?? null;
  return same.length === 1 ? same[0]! : null;
}

export const locationIdFor = (building: string, floor: number, room: string) =>
  `loc-${slugify(building)}-${floor}-${slugify(room)}`;

// ── Preview: what will this import do? ─────────────────────────────────────

export type ImportSummary = {
  projects: number;
  updatedProjects: number;
  matchedRooms: number;
  /** rooms in the sheet that aren't on the floor plan (will be created unplaced) */
  unmatchedRooms: string[];
  newSubjects: string[];
};

export function summarize(parsed: ParsedImport, existing: ExistingData): ImportSummary {
  const subjectNames = new Set(existing.categories.map((c) => c.name.toLowerCase()));
  const nums = new Set(existing.projectNumbers);
  const newSubjects = new Map<string, string>();
  const unmatched = new Map<string, string>();
  let matched = 0;
  let updated = 0;
  parsed.rows.forEach((r) => {
    if (nums.has(r.number)) updated++;
    [r.categoryName, ...r.relatedNames].forEach((n) => !subjectNames.has(n.toLowerCase()) && newSubjects.set(n.toLowerCase(), n));
    if (findLocation(existing.locations, r.floor, r.room)) matched++;
    else unmatched.set(`${r.floor}|${roomKey(r.room)}`, r.floor === null ? r.room : `${r.room} (${floorLabel(r.floor)})`);
  });
  return {
    projects: parsed.rows.length,
    updatedProjects: updated,
    matchedRooms: matched,
    unmatchedRooms: Array.from(unmatched.values()),
    newSubjects: Array.from(newSubjects.values()),
  };
}

// ── Apply to Supabase ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Category["color"][] = ["indigo", "teal", "gold", "coral"];

async function chunked<T>(rows: T[], fn: (chunk: T[]) => Promise<void>, size = 200) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

export async function applyImport(parsed: ParsedImport) {
  const rows = parsed.rows;
  const existing = await loadExisting();

  // 1. subjects: match by name, create the missing ones
  const catByName = new Map(existing.categories.map((c) => [c.name.toLowerCase(), c.id]));
  const usedIds = new Set(existing.categories.map((c) => c.id));
  const newCats: Category[] = [];
  rows.forEach((r) => {
    [r.categoryName, ...r.relatedNames].forEach((name) => {
      const key = name.toLowerCase();
      if (catByName.has(key)) return;
      let id = slugify(name) || "subject";
      while (usedIds.has(id)) id += "-2";
      usedIds.add(id);
      catByName.set(key, id);
      newCats.push({ id, name, icon: "sparkles", color: CATEGORY_COLORS[(existing.categories.length + newCats.length) % 4] ?? "indigo" });
    });
  });
  if (newCats.length) {
    const { error } = await supabase.from("categories").insert(newCats);
    check(error, "Saving subjects");
  }

  // 2. rooms: use the floor-plan room when it matches; otherwise create an unplaced one
  const locs = [...existing.locations];
  const toCreate = new Map<string, any>();
  const toPosition = new Map<string, any>();
  const locationOf = new Map<number, string>(); // project number -> location id
  rows.forEach((r) => {
    let loc = findLocation(locs, r.floor, r.room);
    if (!loc) {
      const floor = r.floor ?? 0;
      const id = locationIdFor(r.building, floor, r.room);
      loc = { id, building: r.building, floor, room: r.room };
      locs.push(loc);
      toCreate.set(id, { id, building: r.building, floor, room: r.room, x_coordinate: 50, y_coordinate: 50, placed: false });
    }
    locationOf.set(r.number, loc.id);
    if (r.x !== null && r.y !== null) {
      toPosition.set(loc.id, { id: loc.id, building: loc.building, floor: loc.floor, room: loc.room, x_coordinate: r.x, y_coordinate: r.y, placed: true });
    }
  });
  await chunked(Array.from(toCreate.values()), async (c) => {
    const { error } = await supabase.from("locations").upsert(c, { onConflict: "id", ignoreDuplicates: true });
    check(error, "Saving rooms");
  });
  await chunked(Array.from(toPosition.values()), async (c) => {
    const { error } = await supabase.from("locations").upsert(c);
    check(error, "Positioning rooms");
  });

  // 3. projects (matched on project number, so re-importing updates instead of duplicating).
  //    The slug depends only on the number, so printed QR codes keep working however names are edited.
  const projectRows = rows.map((r) => ({
    project_number: r.number,
    name: r.name,
    slug: `project-${r.number}`,
    tagline: r.tagline,
    description: r.about,
    members: r.members,
    category_id: catByName.get(r.categoryName.toLowerCase()) ?? "other",
    related_category_ids: r.relatedNames.map((n) => catByName.get(n.toLowerCase())).filter(Boolean),
    location_id: locationOf.get(r.number) ?? null,
    featured: r.featured,
    active: true,
  }));
  await chunked(projectRows, async (c) => {
    const { error } = await supabase.from("projects").upsert(c, { onConflict: "project_number" });
    check(error, "Saving projects");
  });
}

// ── Sheets for download ────────────────────────────────────────────────────

const bold = (value: string) => ({ value, fontWeight: "bold" as const });

export type RoomRef = { floor: number; room: string };

/** The valid room names, from the live floor plan if rooms exist, otherwise the built-in school plan. */
export function roomReference(locations: Pick<Location, "floor" | "room">[]): RoomRef[] {
  const list: RoomRef[] = locations.length
    ? locations.map((l) => ({ floor: l.floor, room: l.room }))
    : SCHOOL_ROOMS.filter((r) => r.kind === "room").map((r) => ({ floor: r.floor, room: r.room }));
  return list.sort((a, b) => a.floor - b.floor || a.room.localeCompare(b.room, undefined, { numeric: true }));
}

const PROJECT_COLS = [14, 30, 36, 28, 18, 30, 8, 22, 60, 10].map((width) => ({ width }));
const ROOM_COLS = [8, 16, 40].map((width) => ({ width }));
type SheetDef = { data: any[][]; sheet: string; columns: { width: number }[] };

function roomsSheet(rooms: RoomRef[]): any[][] {
  return [
    ["Floor", "Floor name", "Room (use exactly this in the Room column)"].map(bold),
    ...rooms.map((r) => [r.floor, floorLabel(r.floor), r.room]),
  ];
}

export function templateSheets(rooms: RoomRef[]): SheetDef[] {
  return [
    {
      sheet: "Projects",
      columns: PROJECT_COLS,
      data: [
        TEMPLATE_HEADERS.map(bold),
        [1, "Water Quality Sensor", "Low-cost live water testing", "Meera S., Devan R.", "Environment", "Chemistry, Computer Science", 3, "7A",
         "A sensor pod that checks water quality and sends results to a phone.", "yes"],
        [2, "Smart Delivery Bot", "A robot that carries parcels between classes", "Arjun T., Sana W.", "Robotics", "Physics", 1, "2C",
         "A small robot that navigates corridors to deliver items.", "no"],
      ],
    },
    { sheet: "Rooms", columns: ROOM_COLS, data: roomsSheet(rooms) },
  ];
}

export function projectsSheets(projects: Project[], locations: Location[], categories: Category[], rooms: RoomRef[]): SheetDef[] {
  const locById = new Map(locations.map((l) => [l.id, l]));
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const rows = projects.map((p) => {
    const l = locById.get(p.locationId);
    return [
      p.projectNumber, p.name, p.tagline, p.members.join(", "), catById.get(p.categoryId) ?? "",
      p.relatedCategoryIds.map((id) => catById.get(id) ?? "").filter(Boolean).join(", "), l?.floor ?? "", l?.room ?? "", p.about, p.featured ? "yes" : "no",
    ];
  });
  return [
    { sheet: "Projects", columns: PROJECT_COLS, data: [TEMPLATE_HEADERS.map(bold), ...rows] },
    { sheet: "Rooms", columns: ROOM_COLS, data: roomsSheet(rooms) },
  ];
}
