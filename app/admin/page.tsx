"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError("Supabase isn't configured yet (missing env vars) — see README_PATCH.md.");
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/admin/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
      <h1 className="font-display text-2xl font-bold">KHOJ Admin</h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Sign in with the Supabase account you added to <code>admin_users</code>.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
          className="w-full rounded-lg border border-line px-4 py-3 text-sm dark:border-white/15 dark:bg-white/5"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-line px-4 py-3 text-sm dark:border-white/15 dark:bg-white/5"
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper disabled:opacity-40 dark:bg-paper dark:text-ink"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
