"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { supabase } from "@/lib/supabase";
import { buildQrPdf, downloadPdf } from "@/lib/qr-pdf";
import { buildSheetPages, fetchQrRows, projectQrUrl, roomTitle, type QrRow as Row } from "@/lib/qr-sheets";

/** Print-ready A4 sheets, one room per page (more pages if a room has over 8 projects). */
export default function QrSheetPage() {
  const ready = useAdminGuard();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [codes, setCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchQrRows()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load projects."));
  }, [ready]);

  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  const urlFor = (r: Row) => projectQrUrl(cleanBase, r.slug);

  // Regenerate the QR images whenever the projects or the website address change.
  useEffect(() => {
    if (!rows || !cleanBase) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const r of rows) {
        next[r.id] = await QRCode.toDataURL(urlFor(r), {
          width: 600,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
      }
      if (!cancelled) setCodes(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cleanBase]);

  // Group by room (lowest floor first, then room name); every room starts on a new page.
  const { pages, roomSummary } = useMemo(() => buildSheetPages(rows ?? []), [rows]);

  if (!ready) return null;

  return (
    <div>
      <style>{CSS}</style>

      <div className="qr-controls mx-auto max-w-3xl px-4 py-6">
        <Link href="/admin/dashboard" className="text-sm underline opacity-70">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold">QR code sheets — by room</h1>
        <p className="mt-1 text-sm opacity-70">
          Each room gets its own A4 page(s) with the room named at the top and that room’s QR codes below (8 per page), so sheets can be handed out room by room.
          Scanning a code opens that project and unlocks rating and the passport badge.
        </p>

        <label className="mt-4 block text-sm font-medium">
          Website address the QR codes should open
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-site.vercel.app"
            className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm"
          />
        </label>
        {/localhost|127\.0\.0\.1/.test(baseUrl) && (
          <p className="mt-2 rounded-lg bg-coral/20 px-3 py-2 text-sm">
            This is a local address, so phones won’t be able to open these codes. Replace it with your live website address (or open this page from the live site) before printing.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            disabled={!rows || Object.keys(codes).length !== rows.length}
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
          >
            🖨 Print this preview
          </button>
          <button
            onClick={() => {
              downloadPdf(buildQrPdf(pages, cleanBase), `KHOJ_QR_codes_${new Date().toISOString().slice(0, 10)}.pdf`);
            }}
            disabled={!rows || !cleanBase}
            className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            ⬇ Download PDF
          </button>
          <span className="text-sm opacity-70">
            {rows ? `${rows.length} codes · ${roomSummary.length} rooms · ${pages.length} page${pages.length === 1 ? "" : "s"}` : "Loading…"}
          </span>
        </div>
        <p className="mt-2 text-xs opacity-60">
          In the print window choose paper size A4, scale 100% (not “fit to page”), margins “None”, and pick “Save as PDF” to get a file.
        </p>
        {error && <p className="mt-3 rounded-lg bg-coral/20 px-3 py-2 text-sm">{error}</p>}

        {roomSummary.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer opacity-80">Rooms and page counts</summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {roomSummary.map((r) => (
                <li key={r.room}>
                  {roomTitle(r.room)} <span className="opacity-60">· {r.count} ({r.pages} p.)</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="qr-pages">
        {pages.map((page, pi) => {
          const n = page.rows.length;
          return (
            <section key={pi} className="qr-sheet">
              <div className="qr-head">
                <div className="qr-room-title">{page.title}</div>
                <div className="qr-room-meta">
                  {[page.floorLabel, `${page.rows.length} project${page.rows.length === 1 ? "" : "s"} on this page`, page.parts > 1 ? `page ${page.part} of ${page.parts}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="qr-grid">
                {page.rows.map((r, i) => {
                  const team = r.teams?.name?.trim();
                  const showTeam = team && team !== r.name;
                  const edgeRight = i % 2 === 1 || i === n - 1;
                  const edgeBottom = i + 2 >= n; // nothing below this cell, so close it off
                  return (
                    <div key={r.id} className={`qr-cell${edgeRight ? " er" : ""}${edgeBottom ? " eb" : ""}`}>
                      <div className="qr-code">
                        {codes[r.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={codes[r.id]} alt={`QR code for ${r.name}`} />
                        ) : null}
                      </div>
                      <div className="qr-text">
                        <div className="qr-num">KHOJ 2026 · #{String(r.project_number).padStart(3, "0")}</div>
                        <div className="qr-name">{r.name}</div>
                        {showTeam && <div className="qr-team">{team}</div>}
                        <div className="qr-hint">Scan to rate this project and add its badge to your passport</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.qr-pages { display: flex; flex-direction: column; align-items: center; gap: 16px; padding-bottom: 40px; }
.qr-sheet {
  box-sizing: border-box; width: 210mm; height: 297mm; padding: 6mm; background: #fff; color: #000;
  display: flex; flex-direction: column; page-break-after: always; break-after: page;
  font-family: Arial, Helvetica, sans-serif;
}
.qr-sheet:last-child { page-break-after: auto; break-after: auto; }
.qr-head { flex: 0 0 auto; padding: 1mm 2mm 4mm; border-bottom: 0.6mm solid #000; margin-bottom: 3mm; }
.qr-room-title { font-size: 28pt; font-weight: 800; line-height: 1.05; }
.qr-room-meta { margin-top: 1.5mm; font-size: 9pt; color: #444; }
.qr-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr); }
.qr-cell {
  box-sizing: border-box; display: flex; align-items: center; gap: 4mm; padding: 3mm 4mm; overflow: hidden;
  border-top: 0.3mm dashed #777; border-left: 0.3mm dashed #777;
}
.qr-cell.er { border-right: 0.3mm dashed #777; }
.qr-cell.eb { border-bottom: 0.3mm dashed #777; }
.qr-code { flex: 0 0 44mm; width: 44mm; height: 44mm; }
.qr-code img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.qr-text { flex: 1; min-width: 0; }
.qr-num { font-size: 7pt; letter-spacing: 0.08em; color: #555; text-transform: uppercase; }
.qr-name { margin-top: 1.5mm; font-size: 13pt; font-weight: 700; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
.qr-team { margin-top: 1.5mm; font-size: 9pt; color: #333; }
.qr-hint { margin-top: 2.5mm; font-size: 6.5pt; color: #666; line-height: 1.25; }
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  header, nav, .qr-controls { display: none !important; }
  .qr-pages { display: block; padding: 0; gap: 0; }
  main { padding: 0 !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
