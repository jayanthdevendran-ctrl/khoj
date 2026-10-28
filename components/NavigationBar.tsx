"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import AccountMenu from "@/components/AccountMenu";

const ITEMS = [
  { href: "/", label: "Home", glyph: "◆" },
  { href: "/explore", label: "Explore", glyph: "⬡" },
  { href: "/projects", label: "Projects", glyph: "◈" },
  { href: "/passport", label: "Passport", glyph: "▣" },
  { href: "/awards", label: "Awards", glyph: "◉" },
];

export default function NavigationBar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Desktop top nav */}
      <header className="sticky top-0 z-40 hidden border-b border-line bg-paper/90 backdrop-blur md:block dark:border-white/10 dark:bg-night/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/khoj-logo.png" alt="" className="h-10 w-10 rounded-full" />
            KHOJ <span className="text-gold">2026</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-ink text-paper dark:bg-paper dark:text-ink"
                    : "text-ink/70 hover:bg-mist dark:text-paper/70 dark:hover:bg-white/10"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <AccountMenu variant="dropdown" />
        </div>
      </header>

      {/* Mobile top nav */}
      <nav
        className="sticky top-0 z-40 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden dark:border-white/10 dark:bg-night/95"
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-between gap-0.5 px-2">
          <Link href="/" aria-label="KHOJ 2026 home" className="flex shrink-0 items-center pr-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/khoj-logo.png" alt="" className="h-9 w-9 rounded-full" />
          </Link>
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <span
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors",
                  isActive(item.href) ? "bg-gold text-ink" : "text-ink/50 dark:text-paper/50"
                )}
              >
                {item.glyph}
              </span>
              <span className={isActive(item.href) ? "text-ink dark:text-paper" : "text-ink/50 dark:text-paper/50"}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
