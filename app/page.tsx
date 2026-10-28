"use client";

import Link from "next/link";
import { useVisitor } from "@/lib/visitor-store";
import { computeStats } from "@/lib/achievements";
import { explorerCode } from "@/lib/explorer-code";
import { rankProjects } from "@/lib/ranking";
import ProjectCard from "@/components/ProjectCard";
import CompassProgress from "@/components/CompassProgress";
import { useProjectData } from "@/lib/project-data";

export default function HomePage() {
  const { state } = useVisitor();
  const { projects, getAggregate } = useProjectData();
  const stats = computeStats(state.badges, state.ratings, projects);

  const ranked = rankProjects(projects.map((p) => ({ id: p.id, ...getAggregate(p.id) })));
  const topProjects = ranked
    .filter((r) => r.count > 0)
    .slice(0, 3)
    .map((r) => projects.find((p) => p.id === r.id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const featured = projects.filter((p) => p.featured).slice(0, 3);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#12347a]/60 to-transparent text-paper">
        <div className="dot-grid absolute inset-0 opacity-30" aria-hidden />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 pb-10 pt-8 text-center sm:px-6 md:flex-row md:justify-between md:pb-24 md:pt-20 md:text-left">
          <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Triennial Science Fair</p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl leading-[1.05] tracking-tight md:text-7xl">
            KHOJ <span className="text-gold">2026</span>
          </h1>
          <p className="mt-4 font-display text-xl text-paper/80 md:text-2xl">Explore. Discover. Question.</p>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-paper/60 md:text-base">
            Wander the campus, uncover student projects at every turn, scan a QR at each one to collect its team
            badge, and fill your KHOJ Passport. Your ratings decide the People&apos;s Choice Award — the projects you rate
            decide the Explorer Award.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link
              href="/explore"
              className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
            >
              Explore KHOJ →
            </Link>
            <Link
              href="/projects"
              className="rounded-full border border-paper/25 px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-white/10"
            >
              View Projects
            </Link>
          </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/khoj-logo.png" alt="KHOJ 2026 Samanvay" className="h-44 w-44 shrink-0 rounded-full shadow-card md:h-72 md:w-72" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 md:space-y-14 md:py-12">
        {/* PASSPORT PREVIEW */}
        <section>
          <SectionHeading eyebrow="01 — Your Collection" title="Your Passport" desc="Every scanned project becomes a badge. Fill your passport with team badges." />
          <div className="mt-5 flex flex-col items-center gap-6 rounded-xl2 border border-line bg-white p-6 shadow-card dark:border-white/10 dark:bg-white/5 md:flex-row md:justify-between">
            <CompassProgress value={stats.projectsExplored} total={projects.length} label="explored" />
            <div className="flex-1 text-center md:text-left">
              <p className="font-display text-lg font-semibold">
                {stats.projectsExplored} / {projects.length} Projects Explored
              </p>
              <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
                Explorer ID <span className="font-mono">{explorerCode(state.explorerId)}</span>
              </p>
              <Link
                href="/passport"
                className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper dark:bg-paper dark:text-ink"
              >
                Open My Passport
              </Link>
            </div>
          </div>
        </section>

        {/* PEOPLE'S CHOICE PREVIEW */}
        <section>
          <SectionHeading eyebrow="02 — Live Rankings" title="People's Choice" desc="Ranked by a weighted score, not just raw stars — so a handful of 5-star votes can't outrank real crowd favorites." />
          {topProjects.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {topProjects.map((p, i) => (
                <div key={p.id} className="rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
                  <p className="font-mono text-xs text-gold-deep dark:text-gold">{["🥇 1st", "🥈 2nd", "🥉 3rd"][i]}</p>
                  <p className="mt-1 font-display font-semibold">{p.name}</p>
                  {p.tagline && <p className="text-xs text-ink/50 dark:text-paper/50">{p.tagline}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-xl2 border border-dashed border-line p-6 text-center text-sm text-ink/50 dark:border-white/15 dark:text-paper/50">
              Rankings will appear once visitors start rating projects.
            </p>
          )}
          <Link href="/awards" className="mt-4 inline-block text-sm font-medium text-teal-deep dark:text-teal-soft">
            See full rankings →
          </Link>
        </section>

        {/* QR EXPLAINER */}
        <section>
          <SectionHeading eyebrow="03 — How It Works" title="Explore. Collect. Discover." desc="Every project has a unique QR code at its table." />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { step: "Find a project", desc: "Use the map to walk to any project across campus." },
              { step: "Scan its QR", desc: "Each project has a unique code — scanning opens its page instantly." },
              { step: "Collect & rate", desc: "Add the team's badge to your Passport, then rate what you saw." },
            ].map((s, i) => (
              <div key={s.step} className="rounded-xl2 border border-line bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <span className="font-mono text-xs text-ink/40 dark:text-paper/40">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 font-display font-semibold">{s.step}</p>
                <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURED / LIVE AT KHOJ */}
        {featured.length > 0 && (
          <section>
            <SectionHeading eyebrow="04 — Featured" title="Live at KHOJ" desc="A few projects worth a detour." />
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {featured.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-deep dark:text-teal-soft">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-bold md:text-3xl">{title}</h2>
      <p className="mt-1 max-w-xl text-sm text-ink/60 dark:text-paper/60">{desc}</p>
    </div>
  );
}
