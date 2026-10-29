"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { buildQrPdf, downloadPdf } from "@/lib/qr-pdf";
import { buildSheetPages, fetchQrRows, roomTitle } from "@/lib/qr-sheets";

/** Admin tab: one button that downloads a PDF of every project's QR code, built from the current projects. */
export default function QrPdfPanel() {
  const [baseUrl, setBaseUrl] = useState("");
  const [summary, setSummary] = useState<{ projects: number; rooms: { room: string; count: number; pages: number }[]; pages: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  // Shows how many projects/rooms/pages the PDF would contain right now.
  const refreshSummary = useCallback(async () => {
    try {
      const rows = await fetchQrRows();
      const { pages, roomSummary } = buildSheetPages(rows);
      setSummary({ projects: rows.length, rooms: roomSummary, pages: pages.length });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not load projects." });
    }
  }, []);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  async function download() {
    setBusy(true);
    setMessage(null);
    try {
      // Always rebuilt from the live project list, so it reflects every change since the last download.
      const rows = await fetchQrRows();
      const { pages, roomSummary } = buildSheetPages(rows);
      const bytes = buildQrPdf(pages, baseUrl);
      downloadPdf(bytes, `KHOJ_QR_codes_${new Date().toISOString().slice(0, 10)}.pdf`);
      setSummary({ projects: rows.length, rooms: roomSummary, pages: pages.length });
      setMessage({ kind: "ok", text: `Downloaded a PDF with ${rows.length} QR codes on ${pages.length} pages.` });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not make the PDF." });
    } finally {
      setBusy(false);
    }
  }

  const local = /localhost|127\.0\.0\.1/.test(baseUrl);

  return (
    <section className="rounded-xl2 border border-line p-4 dark:border-white/10">
      <h2 className="font-display text-lg font-semibold">QR codes (PDF)</h2>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Downloads one PDF with a QR code for every active project: A4, 8 per page, one room per page with the room named at the top, and dashed lines to cut along.
        It is rebuilt from the current projects every time you press the button, so after you add, rename, move or remove projects, just download it again.
      </p>

      <label className="mt-4 block text-sm font-medium">
        Website address the QR codes should open
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://your-site.vercel.app"
          className="mt-1 w-full max-w-xl rounded-lg border border-line bg-transparent px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5"
        />
      </label>
      {local && (
        <p className="mt-2 rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
          This is a local address, so phones won’t be able to open these codes. Open the admin page from your live site, or type the live address above.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy || !baseUrl.trim()}
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {busy ? "Making PDF…" : "⬇ Download QR codes PDF"}
        </button>
        <Link href="/admin/qr-sheet" className="rounded-full border border-line px-5 py-2.5 text-sm dark:border-white/20">
          Preview / print on screen
        </Link>
        <span className="text-sm text-ink/60 dark:text-paper/60">
          {summary ? `${summary.projects} projects · ${summary.rooms.length} rooms · ${summary.pages} pages` : "Loading…"}
        </span>
      </div>

      {message && (
        <p role="status" className={`mt-3 rounded-lg px-4 py-3 text-sm ${message.kind === "ok" ? "bg-teal-soft text-teal-deep" : "bg-coral-soft text-coral"}`}>
          {message.text}
        </p>
      )}

      {summary && summary.rooms.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer opacity-80">Rooms in the PDF</summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {summary.rooms.map((r) => (
              <li key={r.room}>
                {roomTitle(r.room)} <span className="opacity-60">· {r.count} ({r.pages} p.)</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
