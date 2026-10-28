import readXlsxFile from "read-excel-file/browser";
import { strFromU8, unzipSync } from "fflate";

export type ExcelTeamRecord = {
  sourceRow: number;
  teamName: string;
  title: string;
  premise: string;
  room: string;
  members: string[];
  /** Subjects, main subject first (optional "Subjects" column). */
  subjects: string[];
  logoFileName: string;
  logoBytes: Uint8Array | null;
  logoMime: string | null;
};

const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DRAW_NS = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const DRAW_MAIN_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

function xml(files: Record<string, Uint8Array>, path: string): Document | null {
  const bytes = files[path];
  if (!bytes) return null;
  return new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
}
function attr(el: Element | null, name: string): string | null {
  return el?.getAttribute(name) ?? null;
}
function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/^\//, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop(); else parts.push(part);
  }
  return parts.join("/");
}
function resolveTarget(baseFile: string, target: string): string {
  if (target.startsWith("/")) return normalizePath(target);
  return normalizePath(`${baseFile.slice(0, baseFile.lastIndexOf("/"))}/${target}`);
}
function relationships(files: Record<string, Uint8Array>, path: string): Map<string, string> {
  const doc = xml(files, path);
  const result = new Map<string, string>();
  if (!doc) return result;
  for (const rel of Array.from(doc.getElementsByTagNameNS(PKG_REL_NS, "Relationship"))) {
    const id = attr(rel, "Id");
    const target = attr(rel, "Target");
    if (id && target) result.set(id, target);
  }
  return result;
}

const EMU_PER_POINT = 12700;

/**
 * The (0-based) row that holds most of a picture. Excel anchors a picture by its top-left corner, but
 * Numbers (and some other tools) use a two-corner anchor that can start at the very bottom of the row
 * ABOVE the one the picture is drawn in — using the start row would give every team its neighbour's logo.
 */
export function pictureRow(fromRow: number, fromOffset: number, toRow: number | null, toOffset: number, heightOf: (row: number) => number): number {
  if (toRow === null || toRow <= fromRow) return fromRow;
  let best = fromRow;
  let bestOverlap = -1;
  for (let r = fromRow; r <= toRow; r++) {
    const start = r === fromRow ? fromOffset : 0;
    const end = r === toRow ? toOffset : heightOf(r);
    const overlap = Math.max(0, end - start);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = r;
    }
  }
  return best;
}

/** Reads the Teams sheet and maps embedded Excel drawing images back to their worksheet rows. */
export async function parseKhojWorkbook(file: File): Promise<ExcelTeamRecord[]> {
  if (!/\.xlsx?$/i.test(file.name)) throw new Error("Please upload an Excel .xlsx or .xls file.");
  if (/\.xls$/i.test(file.name)) throw new Error("Please save the workbook as .xlsx first; embedded-logo extraction requires the modern Excel format.");

  const [sheets, arrayBuffer] = await Promise.all([
    readXlsxFile(file, { sheets: ["Teams"] } as any) as Promise<{ sheet: string; data: unknown[][] }[]>,
    file.arrayBuffer(),
  ]);

  const rows = sheets.find(
    (sheet) => sheet.sheet.toLowerCase() === "teams"
  )?.data ?? [];

  if (!rows.length) throw new Error("The workbook's Teams sheet is empty.");
  const headerRow = rows[0] ?? [];
  const headers = headerRow.map((value) => String(value ?? "").trim().toLowerCase());
  const col = (names: string[]) => headers.findIndex((h) => names.includes(h));
  const teamCol = col(["team name", "team", "group name"]);
  const titleCol = col(["project", "project title", "project name", "title"]);
  const membersCol = col(["team members", "student members", "members", "students"]);
  const premiseCol = col(["premise", "building", "block"]);
  const roomCol = col(["room", "room no", "room no.", "classroom"]);
  const logoNameCol = col(["logo file", "logo filename", "logo"]);
  const subjectsCol = col(["subjects", "subject"]);
  if ([teamCol, titleCol, membersCol, premiseCol, roomCol].some((index) => index < 0)) {
    throw new Error("Could not find the expected Teams columns. Required headers: Team Name, Project, Team Members, Premise, Room.");
  }

  const files = unzipSync(new Uint8Array(arrayBuffer));
  const workbook = xml(files, "xl/workbook.xml");
  const workbookRels = relationships(files, "xl/_rels/workbook.xml.rels");
  const sheetElement = workbook ? Array.from(workbook.getElementsByTagNameNS(MAIN_NS, "sheet")).find((s) => attr(s, "name")?.toLowerCase() === "teams") : null;
  if (!sheetElement) throw new Error("The workbook must contain a sheet named 'Teams'.");
  const sheetRelId = sheetElement.getAttributeNS(REL_NS, "id");
  const sheetTarget = sheetRelId ? workbookRels.get(sheetRelId) : null;
  if (!sheetTarget) throw new Error("Could not resolve the Teams worksheet inside this workbook.");
  const sheetPath = resolveTarget("xl/workbook.xml", sheetTarget);
  const sheetRelsPath = `${sheetPath.slice(0, sheetPath.lastIndexOf("/"))}/_rels/${sheetPath.slice(sheetPath.lastIndexOf("/") + 1)}.rels`;
  const sheetRels = relationships(files, sheetRelsPath);
  const sheetDoc = xml(files, sheetPath);
  const drawingEl = sheetDoc?.getElementsByTagNameNS(MAIN_NS, "drawing")[0] ?? null;
  const drawingRelId = drawingEl?.getAttributeNS(REL_NS, "id");
  const drawingTarget = drawingRelId ? sheetRels.get(drawingRelId) : null;
  const imageByRow = new Map<number, { bytes: Uint8Array; mime: string; name: string }>();

  // Row heights (in EMU), needed to tell which row a two-corner picture really sits in.
  const rowHeights = new Map<number, number>();
  const defaultRowHeight = Number(sheetDoc?.getElementsByTagNameNS(MAIN_NS, "sheetFormatPr")[0]?.getAttribute("defaultRowHeight") ?? 15) * EMU_PER_POINT;
  for (const rowEl of Array.from(sheetDoc?.getElementsByTagNameNS(MAIN_NS, "row") ?? [])) {
    const index = Number(rowEl.getAttribute("r")) - 1;
    const ht = Number(rowEl.getAttribute("ht"));
    if (Number.isFinite(index) && Number.isFinite(ht) && ht > 0) rowHeights.set(index, ht * EMU_PER_POINT);
  }
  const heightOf = (row: number) => rowHeights.get(row) ?? defaultRowHeight;

  if (drawingTarget) {
    const drawingPath = resolveTarget(sheetPath, drawingTarget);
    const drawingRelsPath = `${drawingPath.slice(0, drawingPath.lastIndexOf("/"))}/_rels/${drawingPath.slice(drawingPath.lastIndexOf("/") + 1)}.rels`;
    const drawingRels = relationships(files, drawingRelsPath);
    const drawing = xml(files, drawingPath);
    if (drawing) {
      for (const anchor of [...Array.from(drawing.getElementsByTagNameNS(DRAW_NS, "oneCellAnchor")), ...Array.from(drawing.getElementsByTagNameNS(DRAW_NS, "twoCellAnchor"))]) {
        const from = anchor.getElementsByTagNameNS(DRAW_NS, "from")[0];
        const rowText = from?.getElementsByTagNameNS(DRAW_NS, "row")[0]?.textContent;
        const fromOffset = Number(from?.getElementsByTagNameNS(DRAW_NS, "rowOff")[0]?.textContent ?? 0);
        const to = anchor.getElementsByTagNameNS(DRAW_NS, "to")[0];
        const toRowText = to?.getElementsByTagNameNS(DRAW_NS, "row")[0]?.textContent;
        const toOffset = Number(to?.getElementsByTagNameNS(DRAW_NS, "rowOff")[0]?.textContent ?? 0);
        const rowIndex = Number.isFinite(Number(rowText))
          ? pictureRow(Number(rowText), fromOffset, toRowText != null && Number.isFinite(Number(toRowText)) ? Number(toRowText) : null, toOffset, heightOf)
          : NaN;
        const blip = anchor.getElementsByTagNameNS(DRAW_MAIN_NS, "blip")[0];
        const imageRelId = blip?.getAttributeNS(REL_NS, "embed");
        const imageTarget = imageRelId ? drawingRels.get(imageRelId) : null;
        if (!Number.isFinite(rowIndex) || !imageTarget) continue;
        const imagePath = resolveTarget(drawingPath, imageTarget);
        const imageBytes = files[imagePath];
        if (!imageBytes) continue;
        const ext = imagePath.split(".").pop()?.toLowerCase() ?? "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/png";
        // Keep the first logo anchored on each row; decorative duplicate images do not replace it.
        if (!imageByRow.has(rowIndex + 1)) imageByRow.set(rowIndex + 1, { bytes: imageBytes, mime, name: imagePath.split("/").pop() ?? `logo-${rowIndex + 1}.${ext}` });
      }
    }
  }

  const records: ExcelTeamRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const teamName = String(row[teamCol] ?? "").trim();
    const title = String(row[titleCol] ?? "").trim();
    if (!teamName && !title) continue;
    const image = imageByRow.get(i + 1) ?? null;
    records.push({
      sourceRow: i + 1,
      teamName: teamName || title,
      title: title || teamName,
      premise: String(row[premiseCol] ?? "").trim(),
      room: String(row[roomCol] ?? "").trim(),
      members: String(row[membersCol] ?? "").split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean),
      subjects: subjectsCol >= 0 ? String(row[subjectsCol] ?? "").split(/[,;\n|]/).map((s) => s.trim()).filter(Boolean) : [],
      logoFileName: logoNameCol >= 0 ? String(row[logoNameCol] ?? image?.name ?? "").trim() : (image?.name ?? ""),
      logoBytes: image?.bytes ?? null,
      logoMime: image?.mime ?? null,
    });
  }
  if (!records.length) throw new Error("No project rows were found in the Teams sheet.");
  return records;
}