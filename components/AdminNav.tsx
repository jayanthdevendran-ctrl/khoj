"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";

const TABS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/projects", label: "Edit projects" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 dark:border-white/10">
      <div className="flex items-center gap-1">
        <span className="mr-3 font-display text-lg font-bold">KHOJ Admin</span>
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              pathname === t.href ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 hover:bg-mist dark:text-paper/60 dark:hover:bg-white/10"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/admin");
        }}
        className="text-sm text-ink/50 underline dark:text-paper/50"
      >
        Sign out
      </button>
    </div>
  );
}
