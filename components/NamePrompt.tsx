"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useVisitor } from "@/lib/visitor-store";

type AuthMode = "signin" | "signup";

const SCHOOL_EMAIL_MESSAGE = "Please use your school email from the NPS group, like name@npskrm.com.";

/** Turns database/auth errors about the access list into a clear message for students. */
function friendlyAuthError(message: string): string {
  if (/database error saving new user|not on the khoj access list|access list|not allowed|allow-?list/i.test(message)) return SCHOOL_EMAIL_MESSAGE;
  return message;
}

/** Student access is restricted to the email allow-list uploaded by an admin. */
export default function NamePrompt() {
  const pathname = usePathname();
  const { setDisplayName } = useVisitor();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!isSupabaseConfigured) {
        setAuthReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user?.email) {
        if (!cancelled) setAuthReady(true);
        return;
      }
      const allowed = await verifyAllowlistedEmail(user.email);
      if (cancelled) return;
      if (!allowed) {
        await supabase.auth.signOut();
        setError(SCHOOL_EMAIL_MESSAGE);
        setAuthenticated(false);
      } else {
        const name = String(user.user_metadata?.full_name ?? user.email.split("@")[0]).slice(0, 24);
        setDisplayName(name);
        setAuthenticated(true);
        setAccountEmail(user.email);
      }
      setAuthReady(true);
    }
    void initialize();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setAuthenticated(false);
        setAccountEmail(null);
      }
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [setDisplayName]);

  // Admin login has its own email/password flow and must not be blocked by the visitor gate.
  if (pathname.startsWith("/admin")) return null;
  if (!authReady) return null;

  async function signOut() {
    await supabase.auth.signOut();
    setAuthenticated(false);
    setAccountEmail(null);
    setPassword("");
    setNotice(null);
    setError(null);
  }

  async function confirmAllowlistedLogin(userEmail: string) {
    const allowed = await verifyAllowlistedEmail(userEmail);
    if (!allowed) {
      await supabase.auth.signOut();
      setAuthenticated(false);
      setError(SCHOOL_EMAIL_MESSAGE);
      return false;
    }
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const name = String(displayName.trim() || user?.user_metadata?.full_name || userEmail.split("@")[0]).slice(0, 24);
    setDisplayName(name);
    setAuthenticated(true);
    setAccountEmail(userEmail);
    setNotice(null);
    setError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!isSupabaseConfigured) {
      setError("Email/password access needs Supabase. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run the SQL migrations in supabase/.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Enter both your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (authError) throw authError;
        await confirmAllowlistedLogin(normalizedEmail);
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: displayName.trim().slice(0, 24) } },
        });
        if (authError) throw authError;
        if (data.session) {
          await confirmAllowlistedLogin(normalizedEmail);
        } else {
          setNotice("Check your email to confirm your account, then sign in here. KHOJ will verify your email against the organiser's access list before letting you in.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? friendlyAuthError(e.message) : "Sign-in failed. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (authenticated) {
    return (
      <button
        type="button"
        onClick={signOut}
        className="fixed right-3 top-[4.5rem] z-30 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs font-medium shadow-card dark:border-white/15 dark:bg-night/95 md:top-[4.8rem]"
        title={accountEmail ?? "Signed in"}
      >
        Sign out · {accountEmail?.split("@")[0] ?? "Student"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 px-4 backdrop-blur-sm dark:bg-black/80">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl2 bg-white p-5 shadow-card dark:bg-[#0d2252] sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/khoj-logo.png" alt="KHOJ 2026" className="mx-auto mb-3 h-24 w-24 rounded-full" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-deep dark:text-teal-soft">KHOJ 2026 · Student access</p>
        <h2 className="mt-2 font-display text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your KHOJ account"}</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          Use your school email from the NPS group (name@npskrm.com) to sign in or create an account.
        </p>
        <div className="mt-4 grid grid-cols-2 rounded-full border border-line p-1 dark:border-white/15">
          <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className={`rounded-full px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60"}`}>Sign in</button>
          <button type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className={`rounded-full px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60"}`}>Create account</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === "signup" && (
            <input type="text" value={displayName} onChange={(e) => setDisplayNameInput(e.target.value)} maxLength={24} placeholder="Your name (optional)" autoComplete="name" className="w-full rounded-lg border border-line px-4 py-3 text-sm dark:border-white/15 dark:bg-white/5" />
          )}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="School email (name@npskrm.com)" autoComplete="email" className="w-full rounded-lg border border-line px-4 py-3 text-sm dark:border-white/15 dark:bg-white/5" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "signup" ? 8 : undefined} placeholder={mode === "signup" ? "Create password (8+ characters)" : "Password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="w-full rounded-lg border border-line px-4 py-3 text-sm dark:border-white/15 dark:bg-white/5" />
          {error && <p role="alert" className="rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-teal/10 p-3 text-sm text-teal-deep dark:text-teal-soft">{notice}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in and explore" : "Create account"}
          </button>
        </form>
        <p className="mt-3 text-xs text-ink/45 dark:text-paper/45">Only NPS school emails (@npskrm.com) can use KHOJ.</p>
      </div>
    </div>
  );
}

async function verifyAllowlistedEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("student_email_allowlist")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    console.error("[khoj] could not verify the student allow-list", error.message);
    return false;
  }
  return Boolean(data?.email);
}
