"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProjectData } from "@/lib/project-data";
import { useVisitor } from "@/lib/visitor-store";
import { RatingStarsInput, RatingStarsReadonly } from "@/components/RatingStars";
import ProjectQrCode from "@/components/ProjectQrCode";

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { isBadgeCollected, hasRated, collectBadge, submitRating } = useVisitor();
  const { projects, categories, locations, loading, getAggregate } = useProjectData();

  const project = projects.find((p) => p.slug === params.slug);
  const [scanPhase, setScanPhase] = useState<"idle" | "discovering" | "revealed" | "done">("idle");
  const [ratingResult, setRatingResult] = useState<"saved" | "already-rated" | "signed-out" | null>(null);

  // Detect ?scan=1 on the client only, so this route never needs a
  // useSearchParams() Suspense boundary — the whole page is already client-rendered.
  useEffect(() => {
    const isScanEntry = new URLSearchParams(window.location.search).get("scan") === "1";
    setScanPhase(isScanEntry ? "discovering" : "done");
  }, []);

  useEffect(() => {
    if (scanPhase !== "discovering") return;
    const t = setTimeout(() => setScanPhase("revealed"), 1000);
    return () => clearTimeout(t);
  }, [scanPhase]);

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
  const qrUrl = typeof window !== "undefined" ? `${window.location.origin}/project/${project.slug}?scan=1` : `/project/${project.slug}?scan=1`;

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
        <DiscoveryReveal
          project={project}
          categoryName={category?.name ?? ""}
          onContinue={(status) => {
            setScanPhase("done");
            router.replace(`/project/${project.slug}`);
          }}
        />
      )}

      <p className="font-mono text-xs text-ink/40 dark:text-paper/40">Project #{project.projectNumber}</p>
      <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">{project.name}</h1>
      {project.tagline && <p className="mt-1 text-lg text-ink/70 dark:text-paper/70">{project.tagline}</p>}
      {project.team.logoUrl && <div className="mt-4 flex max-w-xs items-center justify-center rounded-xl border border-line bg-white p-4 dark:border-white/10"><img src={project.team.logoUrl} alt={`${project.team.name} logo`} className="max-h-48 max-w-full object-contain" /></div>}

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {project.team.name && <Detail label="Team" value={project.team.name} />}
        {category && <Detail label="Category" value={category.name} />}
        {placeText && <Detail label="Location" value={placeText} />}
      </div>

      <div className="mt-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-mist font-display text-2xl font-bold dark:bg-white/10">
        {teamLabel.slice(0, 2).toUpperCase()}
      </div>

      {project.about && <Section title="About the Project">{project.about}</Section>}
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
          href="/explore"
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
          ) : (
            <RatingStarsInput
              onSubmit={(value) => {
                const res = submitRating(project.id, value);
                setRatingResult(res.status);
              }}
            />
          )}
        </div>
      </div>

      {/* Badge */}
      <div className="mt-6 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">🎟 Collect Badge</h2>
        {collected ? (
          <p className="mt-2 text-sm font-medium text-teal-deep dark:text-teal-soft">✓ You&apos;ve already discovered this project.</p>
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

      {/* QR code */}
      <div className="mt-6 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <h2 className="font-display font-semibold">Project QR Code</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Printed beside this project at KHOJ — scanning it opens this exact page.</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="rounded-xl border border-line bg-paper p-3 dark:border-white/10 dark:bg-night">
            <ProjectQrCode url={qrUrl} />
          </div>
          <div className="text-sm">
            <p className="font-display font-semibold">KHOJ</p>
            <p>{project.name}</p>
            <p className="text-ink/50 dark:text-paper/50">Project #{project.projectNumber}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscoveryReveal({
  project,
  categoryName,
  onContinue,
}: {
  project: import("@/lib/types").Project;
  categoryName: string;
  onContinue: (status: "collected" | "already") => void;
}) {
  const { isBadgeCollected, collectBadge } = useVisitor();
  const alreadyCollected = isBadgeCollected(project.id);
  const [justCollected, setJustCollected] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-paper">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">✨ Project Discovered</p>
      <h2 className="font-display text-3xl font-bold">{project.name}</h2>
      <div
        className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-gold bg-white font-display text-2xl font-bold text-ink ${
          justCollected ? "animate-badge-fly" : ""
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
        <p className="font-display font-semibold">🎟️ {project.team.name || project.name}</p>
        <p className="text-sm text-paper/60">
          {categoryName} · Project #{project.projectNumber}
        </p>
      </div>

      {alreadyCollected ? (
        <p className="text-sm text-paper/70">✓ You&apos;ve already discovered this project.</p>
      ) : (
        <button
          onClick={() => {
            collectBadge(project.id);
            setJustCollected(true);
            setTimeout(() => onContinue("collected"), 500);
          }}
          className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink"
        >
          Add to Passport
        </button>
      )}

      <button onClick={() => onContinue("already")} className="text-xs text-paper/50 underline">
        Skip to project page
      </button>
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
