"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useVisitor } from "@/lib/visitor-store";
import { isValidFullName } from "@/lib/names";
import PermissionsPrompt from "@/components/PermissionsPrompt";

type AuthMode = "signin" | "signup";

/** Test IDs (made by an admin) end with this; typing just "test01" is enough. */
const TEST_ID_DOMAIN = "khoj.test";
const FULL_NAME_MESSAGE = "Please enter your full name (first and last name).";

const SCHOOL_EMAIL_MESSAGE = "That email isn't on the KHOJ list. Please use your NPS school email (for example name@npskrm.com). If you think it should work, ask a KHOJ organiser.";

/** Turns database/auth errors about the access list into a clear message. */
function friendlyAuthError(message: string): string {
  if (/database error saving new user|not on the khoj access list|access list|not allowed|allow-?list/i.test(message)) return SCHOOL_EMAIL_MESSAGE;
  return message;
}

/** Access is restricted to the email allow-list uploaded by an admin. */
export default function NamePrompt() {
  const pathname = usePathname();
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
  const [showPassword, setShowPassword] = useState(false);

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
      // Admins are never signed out by the email-list check (their email is usually not on the list),
      // and nobody is signed out while on an /admin page.
      const onAdminPage = window.location.pathname.startsWith("/admin");
      const allowed = onAdminPage || (await isAdminAccount(user.id)) || (await verifyAllowlistedEmail(user.email));
      if (cancelled) return;
      if (!allowed) {
        await supabase.auth.signOut();
        setError(SCHOOL_EMAIL_MESSAGE);
        setAuthenticated(false);
      } else {
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
  }, []);

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
    const typed = email.trim().toLowerCase();
    // A test ID like "test01" is shorthand for test01@khoj.test.
    const normalizedEmail = typed && !typed.includes("@") ? `${typed}@${TEST_ID_DOMAIN}` : typed;
    if (!normalizedEmail || !password) {
      setError("Enter both your email and password.");
      return;
    }
    if (mode === "signup" && !isValidFullName(displayName)) {
      setError(FULL_NAME_MESSAGE);
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
          options: { data: { full_name: displayName.trim().replace(/\s+/g, " ").slice(0, 80) } },
        });
        if (authError) throw authError;
        if (data.session) {
          await confirmAllowlistedLogin(normalizedEmail);
        } else if (normalizedEmail.endsWith(`@${TEST_ID_DOMAIN}`)) {
          // Test IDs are confirmed automatically, so sign straight in.
          const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
          if (signInError) throw new Error("This test ID already has an account — use Sign in with its password.");
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
      <>
        <FullNameGate />
        <PermissionsPrompt />
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 px-4 backdrop-blur-sm dark:bg-black/80">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl2 bg-white p-5 shadow-card dark:bg-[#0d2252] sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/khoj-logo.png" alt="KHOJ 2026" className="mx-auto mb-3 h-24 w-24 rounded-full" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-deep dark:text-teal-soft">KHOJ 2026 · Sign in</p>
        <h2 className="mt-2 font-display text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your KHOJ account"}</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          Use your NPS school email (for example name@npskrm.com) to sign in or create an account.
        </p>
        <div className="mt-4 grid grid-cols-2 rounded-full border border-line p-1 dark:border-white/15">
          <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className={`rounded-full px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60"}`}>Sign in</button>
          <button type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className={`rounded-full px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 dark:text-paper/60"}`}>Create account</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === "signup" && (
            <label className="block text-sm font-medium">
              Full name <span className="text-coral">*</span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                maxLength={80}
                placeholder="First name and last name"
                autoComplete="name"
                className="mt-1 w-full rounded-lg border border-line px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-white/5"
              />
            </label>
          )}
          <input type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="School email (e.g. name@npskrm.com)" autoComplete="username" className="w-full rounded-lg border border-line px-4 py-3 text-sm dark:border-white/15 dark:bg-white/5" />
          <div className="relative">
          <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "signup" ? 8 : undefined} placeholder={mode === "signup" ? "Create password (8+ characters)" : "Password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="w-full rounded-lg border border-line py-3 pl-4 pr-16 text-sm dark:border-white/15 dark:bg-white/5" />
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-semibold text-gold-deep hover:bg-mist dark:text-gold dark:hover:bg-white/10">
            {showPassword ? "Hide" : "Show"}
          </button>
          </div>
          {mode === "signup" && <p className="-mt-1 text-xs text-ink/50 dark:text-paper/50">Choose a password you will remember — at least 8 letters or numbers.</p>}
          {error && <p role="alert" className="rounded-lg bg-coral/10 p-3 text-sm text-coral">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-teal/10 p-3 text-sm text-teal-deep dark:text-teal-soft">{notice}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in and explore" : "Create account"}
          </button>
        </form>
        <p className="mt-3 text-xs text-ink/45 dark:text-paper/45">Only approved NPS school emails (for example @npskrm.com) can use KHOJ.</p>
      </div>
    </div>
  );
}

async function isAdminAccount(userId: string): Promise<boolean> {
  const { data } = await supabase.from("admin_users").select("id").eq("id", userId).maybeSingle();
  return Boolean(data);
}

async function verifyAllowlistedEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("student_email_allowlist")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    console.error("[khoj] could not verify the allow-list", error.message);
    return false;
  }
  return Boolean(data?.email);
}

/** Asks for the full name once, for accounts created before the name became compulsory. */
function FullNameGate() {
  const { needsFullName, saveFullName } = useVisitor();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!needsFullName) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidFullName(name)) {
      setError(FULL_NAME_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await saveFullName(name.trim().replace(/\s+/g, " "));
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Couldn't save that. Please try again.");
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-card dark:bg-[#0d2252]">
        <h2 className="font-display text-xl font-bold">One more thing</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Please enter your full name to continue.</p>
        <label className="mt-4 block text-sm font-medium">
          Full name <span className="text-coral">*</span>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="First name and last name"
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-line px-4 py-3 text-sm font-normal dark:border-white/15 dark:bg-white/5"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-coral/10 p-3 text-sm text-coral">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40">
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
