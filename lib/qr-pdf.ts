import QRCode from "qrcode";
import { zlibSync } from "fflate";
import { projectQrUrl, type SheetPage } from "@/lib/qr-sheets";

// Builds the printable QR-code PDF in the browser, with no PDF library: A4 pages, one room per page
// (8 codes per page), the room named at the top, dashed lines to cut along. QR codes are drawn as
// sharp vector squares, text uses the PDF's built-in Helvetica.

const MM = 72 / 25.4;
const PAGE_W = 595.276;
const PAGE_H = 841.89;
const MARGIN = 6 * MM;

// Helvetica character widths (1000 units per em), for characters 32..126.
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const WIN_ANSI: Record<string, string> = {
  "\u2018": "\x91", "\u2019": "\x92", "\u201C": "\x93", "\u201D": "\x94", "\u2013": "\x96", "\u2014": "\x97", "\u2026": "\x85", "\u2022": "\x95",
  "\u221A": "sqrt", "\u03C0": "pi", "\u2192": "->", "\u00A0": " ",
};

/** Converts text to bytes the PDF's Helvetica understands (anything it can't show becomes "?"). */
function winAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    const mapped = WIN_ANSI[ch];
    if (mapped !== undefined) out += mapped;
    else {
      const c = ch.codePointAt(0)!;
      out += (c >= 32 && c <= 126) || (c >= 160 && c <= 255) ? ch : "?";
    }
  }
  return out;
}

function textWidth(text: string, size: number, bold: boolean): number {
  const table = bold ? W_BOLD : W_REG;
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    w += c >= 32 && c <= 126 ? table[c - 32]! : 556;
  }
  return (w * size) / 1000;
}

function wrap(text: string, maxWidth: number, size: number, bold: boolean, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const push = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of words) {
    let w = word;
    // A single word longer than the line is broken up.
    while (textWidth(w, size, bold) > maxWidth) {
      let cut = w.length - 1;
      while (cut > 1 && textWidth(w.slice(0, cut), size, bold) > maxWidth) cut--;
      push();
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const trial = line ? `${line} ${w}` : w;
    if (textWidth(trial, size, bold) <= maxWidth) line = trial;
    else {
      push();
      line = w;
    }
  }
  push();
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && textWidth(`${last}...`, size, bold) > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}...`;
    return kept;
  }
  return lines;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const n = (x: number) => (Math.round(x * 100) / 100).toString();

function text(ops: string[], str: string, x: number, y: number, size: number, bold: boolean, gray = 0) {
  ops.push(`BT ${n(gray)} g /${bold ? "F2" : "F1"} ${n(size)} Tf ${n(x)} ${n(y)} Td (${esc(winAnsi(str))}) Tj ET`);
}

function drawQr(ops: string[], url: string, x: number, y: number, box: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 2; // modules of white around the code
  const m = box / (size + quiet * 2);
  ops.push("0 g");
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!data[r * size + c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < size && data[r * size + end]) end++;
      // Tiny overlap so no hairline gaps show between squares in any PDF viewer.
      const rx = x + (quiet + c) * m;
      const ry = y + box - (quiet + r + 1) * m;
      ops.push(`${n(rx)} ${n(ry - 0.2)} ${n((end - c) * m + 0.2)} ${n(m + 0.2)} re`);
      c = end;
    }
  }
  ops.push("f");
}

function pageOps(page: SheetPage, baseUrl: string): string {
  const ops: string[] = [];
  const x0 = MARGIN;
  const x1 = PAGE_W - MARGIN;
  const top = PAGE_H - MARGIN;

  // Room heading
  text(ops, page.title, x0 + 6, top - 26, 26, true);
  const meta = [page.floorLabel, `${page.rows.length} project${page.rows.length === 1 ? "" : "s"} on this page`, page.parts > 1 ? `page ${page.part} of ${page.parts}` : ""].filter(Boolean).join("  |  ");
  text(ops, meta, x0 + 6, top - 40, 9, false, 0.27);
  ops.push(`0 G 1.6 w ${n(x0)} ${n(top - 48)} m ${n(x1)} ${n(top - 48)} l S`);

  // Grid: 2 columns x 4 rows
  const gridTop = top - 56;
  const gridBottom = MARGIN;
  const cellW = (x1 - x0) / 2;
  const cellH = (gridTop - gridBottom) / 4;
  const count = page.rows.length;
  const BOX = 128;

  ops.push("q [3 3] 0 d 0.75 w 0.47 G");
  page.rows.forEach((_, i) => {
    const cx = x0 + (i % 2) * cellW;
    const cy = gridTop - (Math.floor(i / 2) + 1) * cellH;
    ops.push(`${n(cx)} ${n(cy + cellH)} m ${n(cx + cellW)} ${n(cy + cellH)} l S`); // top
    ops.push(`${n(cx)} ${n(cy)} m ${n(cx)} ${n(cy + cellH)} l S`); // left
    if (i % 2 === 1 || i === count - 1) ops.push(`${n(cx + cellW)} ${n(cy)} m ${n(cx + cellW)} ${n(cy + cellH)} l S`); // right edge
    if (i + 2 >= count) ops.push(`${n(cx)} ${n(cy)} m ${n(cx + cellW)} ${n(cy)} l S`); // bottom edge
  });
  ops.push("Q");

  page.rows.forEach((row, i) => {
    const cx = x0 + (i % 2) * cellW;
    const cy = gridTop - (Math.floor(i / 2) + 1) * cellH;
    const qx = cx + 8;
    const qy = cy + (cellH - BOX) / 2;
    drawQr(ops, projectQrUrl(baseUrl, row.slug), qx, qy, BOX);

    const tx = qx + BOX + 6;
    const tw = cx + cellW - 10 - tx;
    const team = row.teams?.name?.trim();
    const nameLines = wrap(row.name, tw, 12.5, true, 5);
    const teamLines = team && team !== row.name ? wrap(team, tw, 9, false, 2) : [];
    const hint = wrap("Scan to rate this project and add its badge to your passport", tw, 6.5, false, 3);
    const blockH = 8 + 4 + nameLines.length * 14.5 + (teamLines.length ? 3 + teamLines.length * 11 : 0) + 6 + hint.length * 8;
    let y = cy + (cellH + blockH) / 2 - 8;
    text(ops, `KHOJ 2026 | #${String(row.project_number).padStart(3, "0")}`, tx, y, 7, false, 0.33);
    y -= 4 + 11;
    nameLines.forEach((l) => {
      text(ops, l, tx, y, 12.5, true);
      y -= 14.5;
    });
    if (teamLines.length) {
      teamLines.forEach((l) => {
        text(ops, l, tx, y, 9, false, 0.2);
        y -= 11;
      });
    }
    y -= 4;
    hint.forEach((l) => {
      text(ops, l, tx, y, 6.5, false, 0.4);
      y -= 8;
    });
  });
  return ops.join("\n");
}

/** Makes the PDF. `baseUrl` is the website address the QR codes should open. */
export function buildQrPdf(pages: SheetPage[], baseUrl: string): Uint8Array {
  const latin1 = (s: string) => {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  };

  const sheets = pages.length ? pages : [{ room: "", title: "No projects yet", floorLabel: "", rows: [], part: 1, parts: 1 } as SheetPage];
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const add = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? latin1(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObject = (id: number) => {
    offsets[id] = length;
    add(`${id} 0 obj\n`);
  };

  // Object numbers: 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold, 5 info, then (page, content) pairs.
  const pageIds = sheets.map((_, i) => 6 + i * 2);
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  startObject(1);
  add("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObject(2);
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${sheets.length} >>\nendobj\n`);
  startObject(3);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
  startObject(4);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");
  const d = new Date();
  const stamp = `D:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
  startObject(5);
  add(`<< /Title (KHOJ 2026 project QR codes) /Producer (KHOJ 2026) /CreationDate (${stamp}) >>\nendobj\n`);

  sheets.forEach((page, i) => {
    const pageId = pageIds[i]!;
    const contentId = pageId + 1;
    const stream = zlibSync(latin1(pageOps(page, baseUrl)), { level: 6 }); // single-byte text: Helvetica reads WinAnsi bytes
    startObject(pageId);
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(PAGE_W)} ${n(PAGE_H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    startObject(contentId);
    add(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`);
    add(stream);
    add("\nendstream\nendobj\n");
  });

  const maxId = 5 + sheets.length * 2;
  const xrefAt = length;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) xref += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  add(xref);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/** Saves the PDF to the user's device. */
export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
