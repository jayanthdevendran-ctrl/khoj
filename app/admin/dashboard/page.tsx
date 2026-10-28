"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import ProjectQrCode from "@/components/ProjectQrCode";
import { parseKhojWorkbook, type ExcelTeamRecord } from "@/lib/excel-import";
import ClearDataPanel from "@/components/ClearDataPanel";
import ActivityHighlights from "@/components/ActivityHighlights";
import FloorplanUploader from "@/components/FloorplanUploader";
import { FLOORS } from "@/lib/floors";
import { useProjectData } from "@/lib/project-data";

type DbProject = {
  id: string; project_number: number; name: string; slug: string; tagline: string | null; description: string | null;
  category_id: string | null; team_id: string | null; location_id: string | null; active: boolean;
  teams?: { name: string; members: string[]; logo_url?: string | null } | null;
  locations?: { building: string; room: string; floor: number } | null;
  categories?: { name: string } | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const ready = useAdminGuard();
  const { refresh: refreshSite } = useProjectData();
  const [awardsVersion, setAwardsVersion] = useState(0);
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrProjectId, setQrProjectId] = useState<string | null>(null);
  const [emailFileName, setEmailFileName] = useState("");
  const [excelFileName, setExcelFileName] = useState("");
  const [parsedProjects, setParsedProjects] = useState<ExcelTeamRecord[]>([]);
  const [emailCount, setEmailCount] = useState<number | null>(null);

  async function loadProjects() {
    setLoadingProjects(true);
    const { data, error } = await supabase.from("projects")
      .select("id,project_number,name,slug,tagline,description,category_id,team_id,location_id,active,teams(name,members,logo_url),locations(building,room,floor),categories(name)")
      .order("project_number", { ascending: true });
    if (error) setMessage(`Could not load projects: ${error.message}`);
    else setProjects((data ?? []) as unknown as DbProject[]);
    setLoadingProjects(false);
  }
  async function loadEmailCount() {
    const { count } = await supabase.from("student_email_allowlist").select("email", { count: "exact", head: true });
    setEmailCount(count ?? 0);
  }
  useEffect(() => { if (ready) { void loadProjects(); void loadEmailCount(); } }, [ready]);

  async function uploadEmailList(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setEmailFileName(file.name); setMessage(""); setBusy(true);
    try {
      const raw = await file.text();
      const emails = Array.from(new Set((raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map(e => e.toLowerCase())));
      if (!emails.length) throw new Error("No valid email addresses were found. Upload a CSV or TXT file containing email addresses.");
      const { error: insertError } = await supabase.from("student_email_allowlist").upsert(emails.map(email => ({ email })), { onConflict: "email", ignoreDuplicates: true });
      if (insertError) throw new Error(`Could not save the email list: ${insertError.message}`);
      await loadEmailCount(); setMessage(`Uploaded ${emails.length} unique email addresses. They have been added to the approved access list.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Email list upload failed."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function parseExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name); setMessage(""); setBusy(true); setParsedProjects([]);
    try {
      const parsed = await parseKhojWorkbook(file);
      setParsedProjects(parsed);
      const withLogos = parsed.filter((record) => record.logoBytes).length;
      setMessage(`Read ${parsed.length} team/project rows from the Teams sheet, including ${withLogos} embedded logo image(s). Review the data, then import.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not read the Excel workbook.");
    } finally { setBusy(false); event.target.value = ""; }
  }

  async function importProjects() {
    if (!parsedProjects.length) return;
    setBusy(true); setMessage("");
    try {
      // Subjects from the workbook become categories (created if missing); the first listed is the project's main subject.
      const subjectNames: string[] = [];
      for (const record of parsedProjects) for (const s of record.subjects) if (!subjectNames.some((n) => slugify(n) === slugify(s))) subjectNames.push(s);
      if (subjectNames.length) {
        const palette = ["indigo", "teal", "gold", "coral"];
        const { error: subjectError } = await supabase.from("categories").upsert(
          subjectNames.map((name, i) => ({ id: slugify(name), name, icon: "flask-conical", color: palette[i % palette.length] })),
          { onConflict: "id" }
        );
        if (subjectError) throw new Error(`Subjects: ${subjectError.message}`);
      }
      const { data: latest, error: latestError } = await supabase.from("projects").select("project_number").order("project_number", { ascending: false }).limit(1).maybeSingle();
      if (latestError) throw latestError;
      let nextProjectNumber = (latest?.project_number ?? 0) + 1;
      let imported = 0;
      let logosUploaded = 0;

      for (const record of parsedProjects) {
        const title = record.title.trim();
        if (!title) continue;
        const premise = record.premise.trim();
        const room = record.room.trim();
        const teamName = record.teamName.trim() || title;
        const teamId = `team-${slugify(teamName).slice(0, 32)}-${record.sourceRow}`;
        const locationId = room ? `loc-khoj-${slugify(room).slice(0, 40)}` : null;
        let logoUrl: string | null = null;

        if (record.logoBytes && record.logoMime) {
          const rawLogoBlob = new Blob([Uint8Array.from(record.logoBytes).buffer as ArrayBuffer], { type: record.logoMime });
          const logoBlob = await optimizeLogo(rawLogoBlob);
          const uploadMime = logoBlob.type || record.logoMime;
          const extension = uploadMime === "image/jpeg" ? "jpg" : uploadMime.split("/")[1] || "png";
          const logoPath = `logos/${teamId}.${extension}`;
          const { error: logoError } = await supabase.storage.from("floorplans").upload(logoPath, logoBlob, { upsert: true, contentType: uploadMime, cacheControl: "3600" });
          if (logoError) throw new Error(`Logo for “${teamName}”: ${logoError.message}`);
          logoUrl = supabase.storage.from("floorplans").getPublicUrl(logoPath).data.publicUrl;
          logosUploaded++;
        }

        const { error: teamError } = await supabase.from("teams").upsert({ id: teamId, name: teamName, members: record.members, ...(logoUrl ? { logo_url: logoUrl } : {}) }, { onConflict: "id" });
        if (teamError) throw new Error(`Team “${teamName}”: ${teamError.message}`);
        if (locationId) {
          const { error: locationError } = await supabase.from("locations").upsert({ id: locationId, building: "NPS Koramangala", floor: 2, room, x_coordinate: 50, y_coordinate: 50 }, { onConflict: "id" });
          if (locationError) throw new Error(`Location for “${title}”: ${locationError.message}`);
        }

        const slug = `${slugify(title)}-${slugify(teamName).slice(0, 24)}-${record.sourceRow}`.slice(0, 110);
        const { data: existing, error: existingError } = await supabase.from("projects").select("id").eq("slug", slug).maybeSingle();
        if (existingError) throw existingError;
        const projectData = { name: title, slug, tagline: teamName === title ? "" : `Team: ${teamName}`, description: premise, category_id: record.subjects[0] ? slugify(record.subjects[0]) : null, related_category_ids: record.subjects.slice(1).map((s) => slugify(s)), team_id: teamId, location_id: locationId, active: true };
        if (existing?.id) {
          const { error } = await supabase.from("projects").update(projectData).eq("id", existing.id);
          if (error) throw new Error(`Project “${title}”: ${error.message}`);
        } else {
          const { error } = await supabase.from("projects").insert({ ...projectData, project_number: nextProjectNumber++ });
          if (error) throw new Error(`Project “${title}”: ${error.message}`);
        }
        imported++;
      }
      setParsedProjects([]);
      setMessage(`Imported/updated ${imported} project rows and uploaded ${logosUploaded} logo image(s). New rooms are added to the 3rd floor at the centre of the map (50, 50); open “Map & rooms” to position them on the uploaded floorplan.`);
      await loadProjects();
    } catch (e) { setMessage(e instanceof Error ? e.message : (e as any)?.message ?? "Excel import failed."); }
    finally { setBusy(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  async function deleteProject(project: DbProject) {
    if (!window.confirm(`Delete “${project.name}”? This permanently removes the project and may cascade-delete its ratings, badges, and scans. This cannot be undone.`)) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) setMessage(`Delete failed: ${error.message}`);
    else { setProjects(current => current.filter(p => p.id !== project.id)); setMessage(`Deleted “${project.name}”.`); }
    setBusy(false);
  }

  if (!ready) return null;
  const activeCount = projects.filter(p => p.active).length;
  return <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="font-display text-2xl font-bold md:text-3xl">KHOJ Admin</h1><p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Manage access, import project details, and maintain the project directory.</p></div><button onClick={async()=>{await supabase.auth.signOut();router.push("/admin");}} className="text-sm text-ink/50 underline dark:text-paper/50">Sign out</button></div>
    {message && <p role="status" className="mt-4 rounded-lg border border-line bg-white p-3 text-sm dark:border-white/10 dark:bg-white/5">{message}</p>}
    <ActivityHighlights refreshSignal={awardsVersion} />
    <section className="mt-6 rounded-xl2 border border-line p-4 dark:border-white/10"><h2 className="font-display text-lg font-semibold">1. Approved student email list</h2><p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Upload a .csv or .txt file containing the email addresses permitted to create student accounts. New addresses are added; existing addresses are kept.</p><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink">Choose email list<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={uploadEmailList} className="hidden" /></label><span className="text-sm text-ink/60 dark:text-paper/60">{emailFileName || "No file selected"}</span><span className="text-sm font-medium">{emailCount === null ? "" : `${emailCount} approved email(s)`}</span></div><p className="mt-2 text-xs text-ink/50 dark:text-paper/50">For security, run the student allow-list migration in Supabase before using this feature.</p></section>
    <section className="mt-5 rounded-xl2 border border-line p-4 dark:border-white/10"><h2 className="font-display text-lg font-semibold">2. Import teams, projects and logos from Excel</h2><p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Upload the KHOJ workbook (.xlsx). The Teams sheet is read for team name, project title, student members, premise, room and embedded logo images. Existing imported rows are updated on re-import.</p><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink">Choose Excel workbook<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={parseExcel} className="hidden" /></label><span className="text-sm text-ink/60 dark:text-paper/60">{excelFileName || "No workbook selected"}</span></div>
      {parsedProjects.length > 0 && <><p className="mt-3 text-sm">{parsedProjects.length} rows detected · {parsedProjects.filter(p=>p.logoBytes).length} embedded logos found. Review the extracted records below.</p><div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto pr-1">{parsedProjects.map((p,i)=><div key={`${p.sourceRow}-${i}`} className="grid gap-2 rounded-lg border border-line p-3 dark:border-white/10 md:grid-cols-2"><div className="md:col-span-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink/50">Excel row {p.sourceRow}</span><span className="text-xs text-teal-deep dark:text-teal-soft">{p.logoBytes ? `Logo: ${p.logoFileName || "embedded image"}` : "No embedded logo found"}</span></div><label className="text-xs font-semibold">Project title<input value={p.title} onChange={e=>setParsedProjects(old=>old.map((r,j)=>j===i?{...r,title:e.target.value}:r))} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5" /></label><label className="text-xs font-semibold">Team name<input value={p.teamName} onChange={e=>setParsedProjects(old=>old.map((r,j)=>j===i?{...r,teamName:e.target.value}:r))} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5" /></label><label className="text-xs font-semibold md:col-span-2">Project premise / description<textarea rows={3} value={p.premise} onChange={e=>setParsedProjects(old=>old.map((r,j)=>j===i?{...r,premise:e.target.value}:r))} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5" /></label><label className="text-xs font-semibold">Room<input value={p.room} onChange={e=>setParsedProjects(old=>old.map((r,j)=>j===i?{...r,room:e.target.value}:r))} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5" /></label><label className="text-xs font-semibold md:col-span-2">Student members (comma-separated)<textarea value={p.members.join(", ")} onChange={e=>setParsedProjects(old=>old.map((r,j)=>j===i?{...r,members:e.target.value.split(/[,;\n|]/).map(s=>s.trim()).filter(Boolean)}:r))} rows={2} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5" /></label></div>)}</div><button disabled={busy} onClick={importProjects} className="mt-4 rounded-full bg-teal-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?"Importing…":`Import ${parsedProjects.length} team/project row(s) and logos`}</button></>}
    </section>
    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">3. Current projects</h2><p className="text-sm text-ink/60 dark:text-paper/60">{activeCount} active · {projects.length} total</p></div><button onClick={()=>void loadProjects()} className="rounded-full border border-line px-4 py-2 text-sm dark:border-white/15">Refresh</button></div>
      <div className="mt-3 overflow-x-auto rounded-xl2 border border-line shadow-card dark:border-white/10"><table className="min-w-full divide-y divide-line text-sm dark:divide-white/10"><thead className="bg-mist/60 text-left text-xs uppercase tracking-wide text-ink/50 dark:bg-white/5 dark:text-paper/50"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Logo</th><th className="px-4 py-3">Project title</th><th className="px-4 py-3">Student members / team</th><th className="px-4 py-3">Premise</th><th className="px-4 py-3">Room</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-line bg-white dark:divide-white/10 dark:bg-white/5">{loadingProjects?<tr><td colSpan={8} className="px-4 py-6 text-center">Loading projects…</td></tr>:projects.length===0?<tr><td colSpan={8} className="px-4 py-6 text-center text-ink/50">No projects found in Supabase.</td></tr>:projects.map(p=><tr key={p.id}><td className="px-4 py-3 font-mono text-xs">{p.project_number}</td><td className="px-4 py-3">{p.teams?.logo_url ? <img src={p.teams.logo_url} alt={`${p.teams.name} logo`} className="h-10 w-12 object-contain" /> : "—"}</td><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{p.teams?.members?.join(", ") || p.teams?.name || "—"}</td><td className="max-w-sm px-4 py-3"><span className="line-clamp-3">{p.description || "—"}</span></td><td className="px-4 py-3">{p.locations?.room || "—"}</td><td className="px-4 py-3">{p.active?"Active":"Inactive"}</td><td className="px-4 py-3"><div className="flex items-center gap-3"><button onClick={()=>setQrProjectId(p.id)} className="text-teal-deep underline dark:text-teal-soft">QR</button><button disabled={busy} onClick={()=>void deleteProject(p)} className="font-semibold text-coral underline disabled:opacity-40">Delete</button></div></td></tr>)}</tbody></table></div>
    </section>
    <section id="floorplans" className="mt-8 rounded-xl2 border border-line p-4 dark:border-white/10">
      <h2 className="font-display text-lg font-semibold">4. Floor plans</h2>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Upload one image per floor. Any rectangular image works — it is shown at its own proportions on the Explore map, and appears for all visitors straight away.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {FLOORS.map((f) => <FloorplanUploader key={f.id} floor={f.id} label={f.label} />)}
      </div>
    </section>
    <ClearDataPanel onCleared={async () => { setAwardsVersion((v) => v + 1); setMessage(""); setParsedProjects([]); await Promise.all([loadProjects(), loadEmailCount(), refreshSite()]); }} />
    {qrProjectId && <QrModal project={projects.find(p=>p.id===qrProjectId)!} onClose={()=>setQrProjectId(null)} />}
  </div>;
}

function QrModal({project,onClose}:{project:DbProject;onClose:()=>void}) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/project/${project.slug}?scan=1` : "";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6" onClick={onClose}><div className="w-full max-w-sm rounded-xl2 bg-white p-6 text-center dark:bg-night" onClick={e=>e.stopPropagation()}><p className="font-mono text-xs uppercase tracking-widest text-ink/50 dark:text-paper/50">KHOJ</p><h3 className="font-display text-lg font-semibold">{project.name}</h3><p className="text-sm text-ink/60 dark:text-paper/60">{project.teams?.name ?? "Project"} · Project #{project.project_number}</p><div className="mt-4 flex justify-center"><ProjectQrCode url={url} size={220}/></div><p className="mt-3 break-all font-mono text-[10px] text-ink/40 dark:text-paper/40">{url}</p><button onClick={onClose} className="mt-4 rounded-full border border-line px-4 py-2 text-sm dark:border-white/15">Close</button></div></div>;
}

function slugify(value:string) { return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50); }


async function optimizeLogo(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 700;
    if (bitmap.width <= maxDimension && bitmap.height <= maxDimension && file.size < 400_000) { bitmap.close(); return file; }
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/png"));
  } catch { return file; }
}
