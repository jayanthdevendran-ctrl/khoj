"use client";

import { useMemo, useState } from "react";
import writeXlsxFile from "write-excel-file/browser";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { useData, floorLabel } from "@/lib/data-store";
import { placeLabel } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import {
  parseProjectsFile,
  loadExisting,
  summarize,
  applyImport,
  templateSheets,
  projectsSheets,
  roomReference,
  slugify,
  locationIdFor,
  type ParsedImport,
  type ExistingData,
} from "@/lib/admin-import";
import type { Project } from "@/lib/types";

export default function AdminProjectsPage() {
  const ready = useAdminGuard();
  const { source, projects, categories, locations, pois, refresh } = useData();

  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [existing, setExisting] = useState<ExistingData | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState<null | "parsing" | "importing">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [query, setQuery] = useState("");

  const live = source === "live";
  const nextNumber = live ? Math.max(0, ...projects.map((p) => p.projectNumber)) + 1 : 1;
  const summary = useMemo(() => (parsed && existing ? summarize(parsed, existing) : null), [parsed, existing]);
  const roomRefs = useMemo(() => {
    const poiRooms = new Set(pois.map((p) => p.locationId));
    return roomReference(live ? locations.filter((l) => !poiRooms.has(l.id)) : []);
  }, [live, locations, pois]);
  const subjectName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.members.join(" ")} ${p.projectNumber}`.toLowerCase().includes(q));
  }, [projects, query]);

  if (!ready) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    setBusy("parsing");
    try {
      setFileName(file.name);
      const ex = await loadExisting();
      setExisting(ex);
      setParsed(await parseProjectsFile(file, Math.max(0, ...ex.projectNumbers) + 1));
    } catch (err: any) {
      setParsed(null);
      setMessage({ kind: "error", text: `Couldn't read that file. Is it an .xlsx Excel file? (${err?.message ?? err})` });
    } finally {
      setBusy(null);
    }
  }

  async function runImport() {
    if (!parsed) return;
    setBusy("importing");
    setMessage(null);
    try {
      await applyImport(parsed);
      await refresh();
      setMessage({
        kind: "ok",
        text: `Imported ${parsed.rows.length} projects. Next: open "Map & rooms" to upload your floor plan and place the rooms.`,
      });
      setParsed(null);
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Import failed." });
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(p: Project) {
    const { error } = await supabase.from("projects").update({ active: !p.active }).eq("id", p.id);
    if (error) return setMessage({ kind: "error", text: error.message });
    refresh();
  }

  async function remove(p: Project) {
    if (!window.confirm(`Delete "${p.name}"? Its QR code will stop working and visitors' badges for it are removed.`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) return setMessage({ kind: "error", text: error.message });
    refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <AdminNav />
      <h1 className="mt-5 font-display text-2xl font-bold">Projects</h1>

      {message && (
        <p className={`mt-3 rounded-lg px-4 py-3 text-sm ${message.kind === "ok" ? "bg-teal-soft text-teal-deep" : "bg-coral-soft text-coral"}`}>{message.text}</p>
      )}

      {/* Excel import */}
      <section className="mt-4 rounded-xl2 border border-line bg-white p-5 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">Import from Excel</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          One row per project. Download the template: its <strong>Rooms</strong> sheet lists every room on your floor plan. Put the project&apos;s{" "}
          <strong>Floor</strong> (0 = Ground, 1 = First, 2 = Second, 3 = Third) and <strong>Room</strong> in the sheet and its pin lands on that room automatically.
          <strong> Main Subject</strong> is used for sorting; <strong>Interconnected Subjects</strong> (comma separated) lets a project also show up under those subjects.
          Importing again <strong>updates</strong> projects with the same Project Number.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => writeXlsxFile(templateSheets(roomRefs)).toFile("khoj-projects-template.xlsx")}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium dark:border-white/15"
          >
            ⬇ Download template
          </button>
          <label className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink">
            {busy === "parsing" ? "Reading…" : "⬆ Choose Excel file"}
            <input type="file" accept=".xlsx" className="hidden" onChange={onFile} disabled={busy !== null} />
          </label>
          {live && (
            <button
              onClick={() => writeXlsxFile(projectsSheets(projects, locations, categories, roomRefs)).toFile("khoj-projects.xlsx")}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium dark:border-white/15"
            >
              Export current projects
            </button>
          )}
        </div>

        {parsed && summary && (
          <div className="mt-5 rounded-xl border border-line p-4 text-sm dark:border-white/10">
            <p className="font-semibold">Ready to import from {fileName}</p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-ink/70 dark:text-paper/70">
              <li>{summary.projects} projects ({summary.updatedProjects} existing will be updated, {summary.projects - summary.updatedProjects} new)</li>
              <li>{summary.matchedRooms} of {summary.projects} matched to a room on the floor plan — their pins are placed automatically</li>
              {summary.newSubjects.length > 0 && <li>New subjects: {summary.newSubjects.join(", ")}</li>}
            </ul>
            {summary.unmatchedRooms.length > 0 && (
              <div className="mt-3 rounded-lg bg-gold-soft/60 p-3 text-gold-deep">
                <p className="font-semibold">{summary.unmatchedRooms.length} room name(s) aren&apos;t on the floor plan:</p>
                <p className="mt-1">{summary.unmatchedRooms.slice(0, 20).join(" · ")}{summary.unmatchedRooms.length > 20 ? " …" : ""}</p>
                <p className="mt-1 text-xs">Check the spelling against the template&apos;s Rooms sheet and re-upload, or import anyway and place those rooms yourself in Map &amp; rooms.</p>
              </div>
            )}
            {parsed.warnings.map((w) => (
              <p key={w} className="mt-2 text-gold-deep">⚠ {w}</p>
            ))}
            {parsed.errors.length > 0 && (
              <div className="mt-3 rounded-lg bg-coral-soft p-3 text-coral">
                <p className="font-semibold">{parsed.errors.length} row(s) have problems and will be skipped:</p>
                <ul className="mt-1 list-inside list-disc">
                  {parsed.errors.slice(0, 15).map((er, i) => (
                    <li key={i}>Row {er.row}: {er.message}</li>
                  ))}
                  {parsed.errors.length > 15 && <li>…and {parsed.errors.length - 15} more</li>}
                </ul>
              </div>
            )}
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-left text-ink/50 dark:text-paper/50">
                  <tr><th className="pr-4">#</th><th className="pr-4">Project</th><th className="pr-4">Main subject</th><th className="pr-4">Also</th><th>Room</th></tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r) => (
                    <tr key={r.number}>
                      <td className="pr-4 font-mono">{r.number}</td><td className="pr-4">{r.name}</td><td className="pr-4">{r.categoryName}</td>
                      <td className="pr-4">{r.relatedNames.join(", ") || "—"}</td><td>{r.floor !== null ? `${floorLabel(r.floor)} · ` : ""}{r.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 5 && <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">…and {parsed.rows.length - 5} more</p>}
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={runImport}
                disabled={busy !== null || parsed.rows.length === 0}
                className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy === "importing" ? "Importing…" : `Import ${parsed.rows.length} projects`}
              </button>
              <button onClick={() => setParsed(null)} className="text-sm underline">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Project list */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{live ? `${projects.length} projects` : "Projects"}</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="rounded-full border border-line px-4 py-2 text-sm dark:border-white/15 dark:bg-white/5"
          />
          <button onClick={() => setEditing("new")} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink">
            + Add project
          </button>
        </div>
      </div>

      {live ? (
        <div className="mt-3 overflow-x-auto rounded-xl2 border border-line shadow-card dark:border-white/10">
          <table className="min-w-full divide-y divide-line text-sm dark:divide-white/10">
            <thead className="bg-mist/60 text-left text-xs uppercase tracking-wide text-ink/50 dark:bg-white/5 dark:text-paper/50">
              <tr>
                <th className="px-4 py-2">#</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Subjects</th>
                <th className="px-4 py-2">Room</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-white dark:divide-white/10 dark:bg-white/5">
              {filtered.map((p) => {
                const loc = locations.find((l) => l.id === p.locationId);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-mono text-xs">{p.projectNumber}</td>
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2">
                      <strong>{subjectName(p.categoryId)}</strong>
                      {p.relatedCategoryIds.length > 0 && <span className="text-ink/60 dark:text-paper/60"> + {p.relatedCategoryIds.map(subjectName).join(", ")}</span>}
                    </td>
                    <td className="px-4 py-2">
                      {loc ? placeLabel(loc) : "—"}
                      {loc && loc.placed === false && <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-semibold text-gold-deep">not on map</span>}
                    </td>
                    <td className="px-4 py-2">{p.active ? "Visible" : <span className="text-ink/40">Hidden</span>}</td>
                    <td className="space-x-3 whitespace-nowrap px-4 py-2 text-right">
                      <button onClick={() => setEditing(p)} className="text-teal-deep underline dark:text-teal-soft">Edit</button>
                      <button onClick={() => toggleActive(p)} className="underline">{p.active ? "Hide" : "Show"}</button>
                      <button onClick={() => remove(p)} className="text-coral underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-sm text-ink/60 dark:border-white/15 dark:text-paper/60">
          No projects of your own yet. Import your Excel sheet above, or use &quot;+ Add project&quot;.
        </p>
      )}

      {editing && (
        <ProjectForm
          project={editing === "new" ? null : editing}
          nextNumber={nextNumber}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

const SUBJECT_COLORS = ["indigo", "teal", "gold", "coral"] as const;

function ProjectForm({
  project,
  nextNumber,
  onClose,
  onSaved,
}: {
  project: Project | null;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { categories, locations, pois, refresh } = useData();
  const poiRooms = useMemo(() => new Set(pois.map((p) => p.locationId)), [pois]);
  const rooms = useMemo(
    () => locations.filter((l) => !poiRooms.has(l.id)).sort((a, b) => a.floor - b.floor || a.room.localeCompare(b.room, undefined, { numeric: true })),
    [locations, poiRooms]
  );
  const [f, setF] = useState({
    name: project?.name ?? "",
    tagline: project?.tagline ?? "",
    members: project?.members.join(", ") ?? "",
    categoryId: project?.categoryId ?? categories[0]?.id ?? "other",
    related: project?.relatedCategoryIds ?? ([] as string[]),
    locationId: project?.locationId ?? "",
    about: project?.about ?? "",
    featured: project?.featured ?? false,
    active: project?.active ?? true,
    number: project?.projectNumber ?? nextNumber,
    newRoom: "",
    newFloor: 0,
    newSubject: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));
  const toggleRelated = (id: string) => set("related", f.related.includes(id) ? f.related.filter((x) => x !== id) : [...f.related, id]);

  async function addSubject() {
    const name = f.newSubject.trim();
    if (!name) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.id !== f.categoryId && !f.related.includes(existing.id)) toggleRelated(existing.id);
      return set("newSubject", "");
    }
    let id = slugify(name) || "subject";
    while (categories.some((c) => c.id === id)) id += "-2";
    const { error: ce } = await supabase.from("categories").insert({ id, name, icon: "sparkles", color: SUBJECT_COLORS[categories.length % 4] });
    if (ce) return setError(ce.message);
    await refresh();
    setF((p) => ({ ...p, newSubject: "", related: [...p.related, id] }));
  }

  async function save() {
    if (!f.name.trim()) return setError("Project name is required.");
    setSaving(true);
    setError(null);
    try {
      let locationId = f.locationId;
      if (locationId === "__new__") {
        if (!f.newRoom.trim()) throw new Error("Enter a name for the new room.");
        locationId = locationIdFor("Main Building", f.newFloor, f.newRoom.trim());
        const { error: le } = await supabase
          .from("locations")
          .upsert({ id: locationId, building: "Main Building", floor: f.newFloor, room: f.newRoom.trim(), x_coordinate: 50, y_coordinate: 50, placed: false }, { onConflict: "id", ignoreDuplicates: true });
        if (le) throw le;
      }

      const row = {
        name: f.name.trim(),
        tagline: f.tagline,
        description: f.about,
        members: f.members.split(/[,;]/).map((m) => m.trim()).filter(Boolean),
        category_id: f.categoryId,
        related_category_ids: f.related.filter((id) => id !== f.categoryId),
        location_id: locationId || null,
        featured: f.featured,
        active: f.active,
      };
      if (project) {
        const { error: pe } = await supabase.from("projects").update(row).eq("id", project.id);
        if (pe) throw pe;
      } else {
        // the slug depends only on the number, so QR codes never break when a project is renamed
        const { error: pe } = await supabase.from("projects").insert({ ...row, project_number: f.number, slug: `project-${f.number}` });
        if (pe) throw pe;
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save.");
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5";
  const label = "mb-1 block text-xs font-medium text-ink/60 dark:text-paper/60";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4" onClick={onClose}>
      <div className="my-6 w-full max-w-2xl rounded-xl2 bg-white p-6 dark:bg-night" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold">{project ? `Edit project #${project.projectNumber}` : "Add project"}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><label className={label}>Project name *</label><input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="md:col-span-2"><label className={label}>Tagline</label><input className={input} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} /></div>
          <div className="md:col-span-2"><label className={label}>Students (comma separated)</label><input className={input} value={f.members} onChange={(e) => set("members", e.target.value)} /></div>

          <div>
            <label className={label}>Main subject</label>
            <select className={input} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Room</label>
            <select className={input} value={f.locationId} onChange={(e) => set("locationId", e.target.value)}>
              <option value="">— none —</option>
              {rooms.map((l) => <option key={l.id} value={l.id}>{placeLabel(l)}</option>)}
              <option value="__new__">+ New room…</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={label}>Interconnected subjects — other subjects this project connects to</label>
            <div className="flex flex-wrap gap-2">
              {categories.filter((c) => c.id !== f.categoryId).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleRelated(c.id)}
                  aria-pressed={f.related.includes(c.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${f.related.includes(c.id) ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink" : "border-line dark:border-white/15"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className={input} placeholder="Add a new subject…" value={f.newSubject} onChange={(e) => set("newSubject", e.target.value)} />
              <button type="button" onClick={addSubject} className="shrink-0 rounded-lg border border-line px-3 text-sm dark:border-white/15">Add</button>
            </div>
          </div>

          {f.locationId === "__new__" && (
            <div className="grid grid-cols-[1fr_110px] gap-2 md:col-span-2">
              <div><label className={label}>New room name</label><input className={input} value={f.newRoom} onChange={(e) => set("newRoom", e.target.value)} /></div>
              <div>
                <label className={label}>Floor</label>
                <select className={input} value={f.newFloor} onChange={(e) => set("newFloor", Number(e.target.value))}>
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{floorLabel(n)}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <label className={label}>About</label>
            <textarea rows={3} className={input} value={f.about} onChange={(e) => set("about", e.target.value)} />
          </div>
          {!project && (
            <div><label className={label}>Project number</label><input type="number" min={1} className={input} value={f.number} onChange={(e) => set("number", Number(e.target.value))} /></div>
          )}
          <div className="flex items-end gap-5 pb-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Visible to visitors</label>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm dark:border-white/15">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
