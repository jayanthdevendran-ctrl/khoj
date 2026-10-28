"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProjectData } from "@/lib/project-data";
import { showForProjectName, hasStarted, formatShowTime, countdown, minutesSinceMidnight, upcomingSlots, useNow } from "@/lib/shows";
import { useVisitor } from "@/lib/visitor-store";
import { RatingStarsInput, RatingStarsReadonly } from "@/components/RatingStars";

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { state, hydrated, isBadgeCollected, hasRated, isScanned, markScanned, collectBadge, submitRating } = useVisitor();
  const { projects, categories, locations, loading, getAggregate, bumpAggregate, refreshStats } = useProjectData();

  const project = projects.find((p) => p.slug === params.slug);
  const [scanPhase, setScanPhase] = useState<"idle" | "discovering" | "revealed" | "done">("idle");
  const [ratingResult, setRatingResult] = useState<"saved" | "already-rated" | "signed-out" | "not-scanned" | null>(null);

  // Rating and adding to the passport unlock only after this project's QR code is scanned.
  // The QR code opens this page with ?scan=1.
  const scanned = project ? isScanned(project.id) : false;

  // Read the link on the client only, so this route never needs a useSearchParams() Suspense boundary.
  useEffect(() => {
    const viaQr = new URLSearchParams(window.location.search).get("scan") === "1";
    setScanPhase(viaQr ? "discovering" : "done");
  }, []);

  // While the "Project Discovered" screen shows, record the scan (once the student is signed in).
  useEffect(() => {
    if (scanPhase !== "discovering" || !project || !hydrated) return;
    if (!markScanned(project.id)) return; // not signed in yet — this runs again after sign-in
    const timer = setTimeout(() => setScanPhase("revealed"), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPhase, project?.id, hydrated, state.explorerId]);

  if (!project && loading) {
    return <div className="mx-auto max-w-xl px-6 py-16 text-center text-sm text-ink/60">Loading project…</div>;
  }
  if (!project) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-display text-2xl font-bold">Project not found</p>
        <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">
          We couldn&apos;t find this project. It may have been renamed or the QR code might not be recognized by KHOJ.
        </p>
        <Link href="/projects" className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper dark:bg-paper dark:text-ink">
          Browse all projects
        </Link>
      </div>
    );
  }

  const category = categories.find((c) => c.id === project.categoryId);
  const location = locations.find((l) => l.id === project.locationId);
  const agg = getAggregate(project.id);
  const teamLabel = project.team.name || project.name;
  const placeText = location ? [location.building, location.room].filter(Boolean).join(" — ") : "";
  const collected = isBadgeCollected(project.id);
  const rated = hasRated(project.id);

  function handleRate(value: number) {
    const res = submitRating(project!.id, value);
    setRatingResult(res.status);
    if (res.status === "saved") {
      bumpAggregate(project!.id, value); // show the new average straight away
      window.setTimeout(() => void refreshStats(), 2500); // then confirm with the server totals
    }
  }

  if (scanPhase === "discovering") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-paper">
        <div className="h-12 w-12 animate-compass-spin rounded-full border-2 border-gold border-t-transparent" />
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-gold">✨ Project Discovered</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      {scanPhase === "revealed" && (
        <ScanFlow
          project={project}
          categoryName={category?.name ?? ""}
          placeText={placeText}
          rated={rated}
          collected={collected}
          onRate={handleRate}
          onCollect={() => collectBadge(project.id).status}
          onContinue={() => {
            setScanPhase("done");
            router.replace(`/project/${project.slug}`);
          }}
        />
      )}

      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/projects"))}
        className="mb-3 inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm hover:bg-mist dark:border-white/20 dark:hover:bg-white/10"
      >
        ← Back
      </button>
      <p className="font-mono text-xs text-ink/40 dark:text-paper/40">Project #{project.projectNumber}</p>
      <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">{project.name}</h1>
      {project.tagline && <p className="mt-1 text-lg text-ink/70 dark:text-paper/70">{project.tagline}</p>}
      {project.team.logoUrl && <div className="mt-4 flex max-w-xs items-center justify-center rounded-xl border border-line bg-white p-4 dark:border-white/10"><img src={project.team.logoUrl} alt={`${project.team.name} logo`} className="max-h-48 max-w-full object-contain" /></div>}

      <ShowTimes projectName={project.name} />

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {project.team.name && <Detail label="Team" value={project.team.name} />}
        {category && <Detail label="Category" value={category.name} />}
        {placeText && <Detail label="Location" value={placeText} />}
      </div>

      {!project.team.logoUrl && (
        <div className="mt-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-mist font-display text-2xl font-bold dark:bg-white/10">
          {teamLabel.slice(0, 2).toUpperCase()}
        </div>
      )}

      {project.about && <Section title="About the Project">{project.about}</Section>}
      {project.team.members.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg font-semibold">
            Team members <span className="font-mono text-sm font-normal text-ink/50 dark:text-paper/50">({project.team.members.length})</span>
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {project.team.members.map((name) => (
              <li key={name} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm dark:border-white/15 dark:bg-white/5">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {project.problem && <Section title="The Problem">{project.problem}</Section>}
      {project.solution && <Section title="The Solution">{project.solution}</Section>}
      {project.impact && <Section title="Why It Matters">{project.impact}</Section>}

      {/* Find this project */}
      <div className="mt-8 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">Find This Project</h2>
        {placeText && (
          <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
            📍 {placeText}
          </p>
        )}
        <Link
          href={`/explore?project=${encodeURIComponent(project.slug)}`}
          className="mt-3 inline-block rounded-full border border-ink px-4 py-2 text-sm font-semibold dark:border-paper"
        >
          Open in Map
        </Link>
      </div>

      {/* Rating */}
      <div className="mt-6 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">⭐ Rate This Project</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          <RatingStarsReadonly value={agg.average} size="md" /> <span className="font-mono text-xs">{agg.average.toFixed(2)} avg · {agg.count} ratings</span>
        </p>
        <div className="mt-4">
          {rated || ratingResult === "saved" ? (
            <p className="text-sm font-medium text-teal-deep dark:text-teal-soft">✓ You&apos;ve already rated this project.</p>
          ) : scanned ? (
            <RatingStarsInput onSubmit={handleRate} />
          ) : (
            <ScanToUnlock text="Scan this project’s QR code at its table to rate it." />
          )}
        </div>
      </div>

      {/* Badge */}
      <div className="mt-6 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">🎟 Collect Badge</h2>
        {collected ? (
          <p className="mt-2 text-sm font-medium text-teal-deep dark:text-teal-soft">✓ You&apos;ve already discovered this project.</p>
        ) : !scanned ? (
          <div className="mt-2">
            <ScanToUnlock text="Scan this project’s QR code at its table to add its badge to your passport." />
          </div>
        ) : !rated && ratingResult !== "saved" ? (
          <div className="mt-2">
            <ScanToUnlock text="Rate this project first, then you can add its badge to your passport." />
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Add {teamLabel}&apos;s badge to your KHOJ Passport.</p>
            <button
              onClick={() => collectBadge(project.id)}
              className="mt-3 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink"
            >
              Add to Passport
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The screen a student sees right after scanning a project's QR code:
 *  1. rate the project, 2. that unlocks "Add to Passport", 3. adding it opens the project page.
 */
function ScanFlow({
  project,
  categoryName,
  placeText,
  rated,
  collected,
  onRate,
  onCollect,
  onContinue,
}: {
  project: import("@/lib/types").Project;
  categoryName: string;
  placeText: string;
  rated: boolean;
  collected: boolean;
  onRate: (value: number) => void;
  onCollect: () => string;
  onContinue: () => void;
}) {
  const [flying, setFlying] = useState(false);
  const details = [categoryName, placeText, `Project #${project.projectNumber}`].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink text-paper">
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center gap-4 px-5 py-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">✨ Project Discovered</p>
        <h2 className="font-display text-2xl font-bold leading-tight">{project.name}</h2>
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-gold bg-white font-display text-2xl font-bold text-ink ${
            flying ? "animate-badge-fly" : ""
          }`}
        >
          {project.team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.team.logoUrl} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            (project.team.name || project.name).slice(0, 2).toUpperCase()
          )}
        </div>
        <div>
          {project.team.name && project.team.name !== project.name && <p className="font-semibold">{project.team.name}</p>}
          <p className="text-sm text-paper/60">{details}</p>
        </div>

        {/* Step 1: rate */}
        <div className="w-full rounded-xl2 border border-white/15 bg-white/5 p-4 text-left">
          <p className="font-mono text-xs uppercase tracking-wider text-gold">Step 1 · Rate this project</p>
          {rated ? (
            <p className="mt-2 text-sm font-medium text-teal-soft">✓ Thanks — you’ve rated this project.</p>
          ) : (
            <div className="mt-3">
              <RatingStarsInput onSubmit={onRate} />
            </div>
          )}
        </div>

        {/* Step 2: unlocked by rating */}
        <div className={`w-full rounded-xl2 border p-4 text-left ${rated ? "border-gold/50 bg-white/5" : "border-white/10 bg-white/[0.03]"}`}>
          <p className={`font-mono text-xs uppercase tracking-wider ${rated ? "text-gold" : "text-paper/40"}`}>Step 2 · Add to your passport</p>
          {collected ? (
            <p className="mt-2 text-sm font-medium text-teal-soft">✓ This project is already in your passport.</p>
          ) : rated ? (
            <button
              type="button"
              onClick={() => {
                const status = onCollect();
                if (status === "new") {
                  setFlying(true);
                  window.setTimeout(onContinue, 600); // then open the project page
                }
              }}
              className="mt-3 w-full rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink"
            >
              Add to Passport
            </button>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-paper/55">
              <span aria-hidden>🔒</span> Rate the project to unlock this.
            </p>
          )}
        </div>

        {collected && (
          <button type="button" onClick={onContinue} className="w-full rounded-full bg-white/10 px-6 py-3 text-sm font-semibold">
            Go to the project page
          </button>
        )}
        <button type="button" onClick={onContinue} className="text-xs text-paper/50 underline">
          Skip to project page
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-mist px-3 py-1 dark:bg-white/10">
      <span className="text-ink/50 dark:text-paper/50">{label}:</span> <strong>{value}</strong>
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink/70 dark:text-paper/70">{children}</p>
    </div>
  );
}

function ScanToUnlock({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-sm text-ink/70 dark:text-paper/70">
      <span aria-hidden>🔒</span>
      <span>{text}</span>
    </p>
  );
}

/** For the three projects that are live shows: their times and a countdown to the next one. */
function ShowTimes({ projectName }: { projectName: string }) {
  const now = useNow();
  const show = showForProjectName(projectName);
  if (!show || !now) return null;
  const nowMin = minutesSinceMidnight(now);
  const next = upcomingSlots(nowMin).find((s) => s.show.key === show.key);
  return (
    <div className="mt-4 rounded-xl2 border border-gold/40 bg-white/5 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">🎭 Live show</p>
      <p className="mt-1 text-sm font-semibold">
        {next ? `Next show: ${formatShowTime(next.time)} — ${countdown(next.start - nowMin)}` : "No more shows today"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {show.times.map((t, i) => {
          const done = hasStarted(t, nowMin);
          return (
            <span
              key={t}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                next?.time === t ? "border-gold bg-gold text-ink" : done ? "border-white/10 text-paper/35 line-through" : "border-white/25"
              }`}
            >
              Show {i + 1}: {formatShowTime(t)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
