"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useVisitor } from "@/lib/visitor-store";

/** Who is signed in, and a way to sign out. Replaces the old button that floated over the page. */
function useAccountEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setEmail(data.session?.user?.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user?.email ?? null));
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);
  return email;
}

export default function AccountMenu({ variant }: { variant: "dropdown" | "card" }) {
  const email = useAccountEmail();
  const { state } = useVisitor();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const name = state.displayName || email?.split("@")[0] || "Account";

  // Close the dropdown when clicking elsewhere or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!email) return null;
  const signOut = () => void supabase.auth.signOut();

  if (variant === "card") {
    return (
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-line bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-ink/50 dark:text-paper/50">Signed in as</p>
          <p className="truncate font-medium">{email}</p>
        </div>
        <button type="button" onClick={signOut} className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-mist dark:border-white/20 dark:hover:bg-white/10">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-medium hover:bg-mist dark:border-white/20 dark:hover:bg-white/10"
      >
        <span aria-hidden>👤</span>
        <span className="max-w-[9rem] truncate">{name}</span>
        <span aria-hidden className="text-xs opacity-60">▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-card dark:border-white/15 dark:bg-[#0d2252]">
          <p className="text-xs uppercase tracking-wide text-ink/50 dark:text-paper/50">Signed in as</p>
          <p className="mt-0.5 truncate text-sm font-medium">{email}</p>
          <button role="menuitem" type="button" onClick={signOut} className="mt-3 w-full rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
