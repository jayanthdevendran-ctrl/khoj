"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const DOMAIN = "khoj.test";
const suffix = `@${DOMAIN}`;

type Row = { email: string; created_at?: string };

/** Admin tab: make dummy (test) IDs so anyone can log in without a school email. */
export default function TestIdsPanel() {
  const [ids, setIds] = useState<Row[] | null>(null);
  const [inUse, setInUse] = useState<Record<string, string | null>>({}); // email -> full name of the account made with it
  const [prefix, setPrefix] = useState("test");
  const [count, setCount] = useState(5);
  const [single, setSingle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("student_email_allowlist").select("email,created_at").like("email", `%${suffix}`).order("email", { ascending: true });
    if (error) {
      setMessage({ kind: "error", text: error.message });
      setIds([]);
      return;
    }
    setIds((data ?? []) as Row[]);
    // Which test IDs already have an account (best effort — needs the v11 database update for names).
    const used = await supabase.from("visitor_leaderboard").select("email,full_name").like("email", `%${suffix}`);
    if (!used.error) setInUse(Object.fromEntries((used.data ?? []).map((r: any) => [String(r.email), r.full_name ?? null])));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "");
  const short = (email: string) => email.replace(suffix, "");

  async function createMany() {
    if (!cleanPrefix) {
      setMessage({ kind: "error", text: "Type a short prefix, like test." });
      return;
    }
    const n = Math.min(50, Math.max(1, Math.floor(count) || 1));
    setBusy(true);
    setMessage(null);
    // Continue numbering after the highest existing number for this prefix.
    const taken = (ids ?? []).map((r) => short(r.email)).filter((s) => s.startsWith(cleanPrefix)).map((s) => Number(s.slice(cleanPrefix.length))).filter(Number.isFinite);
    let next = (taken.length ? Math.max(...taken) : 0) + 1;
    const rows = Array.from({ length: n }, () => ({ email: `${cleanPrefix}${String(next++).padStart(2, "0")}${suffix}` }));
    const { error } = await supabase.from("student_email_allowlist").upsert(rows, { onConflict: "email" });
    setBusy(false);
    if (error) setMessage({ kind: "error", text: error.message });
    else {
      setMessage({ kind: "ok", text: `Created ${rows.length} test ID${rows.length === 1 ? "" : "s"}: ${short(rows[0]!.email)}${rows.length > 1 ? ` … ${short(rows[rows.length - 1]!.email)}` : ""}.` });
      await load();
    }
  }

  async function createOne() {
    const id = single.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!id) {
      setMessage({ kind: "error", text: "Type an ID first, for example pranjal." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("student_email_allowlist").upsert({ email: `${id}${suffix}` }, { onConflict: "email" });
    setBusy(false);
    if (error) setMessage({ kind: "error", text: error.message });
    else {
      setMessage({ kind: "ok", text: `Created test ID “${id}”.` });
      setSingle("");
      await load();
    }
  }

  async function remove(email: string) {
    const { error } = await supabase.from("student_email_allowlist").delete().eq("email", email);
    if (error) setMessage({ kind: "error", text: error.message });
    else await load();
  }

  async function removeAll() {
    if (!window.confirm("Remove ALL test IDs from the approved list? Accounts already made with them keep working until you clear records, but no new test accounts can be made.")) return;
    const { error } = await supabase.from("student_email_allowlist").delete().like("email", `%${suffix}`);
    if (error) setMessage({ kind: "error", text: error.message });
    else {
      setMessage({ kind: "ok", text: "All test IDs removed from the approved list." });
      await load();
    }
  }

  async function copyList() {
    const text = (ids ?? []).map((r) => short(r.email)).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: "ok", text: "Copied the list of test IDs." });
    } catch {
      setMessage({ kind: "error", text: "Couldn't copy automatically — select the IDs and copy them." });
    }
  }

  return (
    <section className="rounded-xl2 border border-line p-4 dark:border-white/10">
      <h2 className="font-display text-lg font-semibold">Test IDs (dummy accounts)</h2>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Make dummy IDs so you can log in and try the site without a school email. A test ID is just a short name like <strong>test01</strong>
        (it is stored as test01{suffix}).
      </p>

      <div className="mt-3 rounded-lg bg-white/5 p-3 text-sm">
        <p className="font-semibold">How to log in with a test ID</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-ink/70 dark:text-paper/70">
          <li>On the site choose <strong>Create account</strong> (the first time only).</li>
          <li>Enter any full name, the test ID (for example <strong>test01</strong>) and a password of 8+ characters.</li>
          <li>You’re signed in straight away. Next time, choose <strong>Sign in</strong> with the same ID and password.</li>
        </ol>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line p-3 dark:border-white/10">
          <h3 className="text-sm font-semibold">Make several at once</h3>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium">
              Prefix
              <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="mt-1 block w-28 rounded-lg border border-line bg-transparent px-3 py-2 text-sm dark:border-white/20" />
            </label>
            <label className="text-xs font-medium">
              How many
              <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 block w-20 rounded-lg border border-line bg-transparent px-3 py-2 text-sm dark:border-white/20" />
            </label>
            <button onClick={() => void createMany()} disabled={busy} className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">
              Create
            </button>
          </div>
          <p className="mt-2 text-xs text-ink/50 dark:text-paper/50">Makes {cleanPrefix || "test"}01, {cleanPrefix || "test"}02 … continuing after any that already exist.</p>
        </div>

        <div className="rounded-xl border border-line p-3 dark:border-white/10">
          <h3 className="text-sm font-semibold">Make one with a name you choose</h3>
          <div className="mt-2 flex items-end gap-2">
            <label className="text-xs font-medium">
              ID
              <input value={single} onChange={(e) => setSingle(e.target.value)} placeholder="pranjal" className="mt-1 block w-40 rounded-lg border border-line bg-transparent px-3 py-2 text-sm dark:border-white/20" />
            </label>
            <button onClick={() => void createOne()} disabled={busy} className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40">
              Create
            </button>
          </div>
        </div>
      </div>

      {message && (
        <p role="status" className={`mt-3 rounded-lg px-4 py-3 text-sm ${message.kind === "ok" ? "bg-teal-soft text-teal-deep" : "bg-coral-soft text-coral"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Current test IDs {ids ? `(${ids.length})` : ""}</h3>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-full border border-line px-3 py-1.5 text-xs dark:border-white/20">Refresh</button>
          {ids && ids.length > 0 && (
            <>
              <button onClick={() => void copyList()} className="rounded-full border border-line px-3 py-1.5 text-xs dark:border-white/20">Copy list</button>
              <button onClick={() => void removeAll()} className="rounded-full border border-coral/50 px-3 py-1.5 text-xs text-coral">Remove all</button>
            </>
          )}
        </div>
      </div>

      {ids === null ? (
        <p className="mt-3 text-sm text-ink/50 dark:text-paper/50">Loading…</p>
      ) : ids.length === 0 ? (
        <p className="mt-3 text-sm text-ink/50 dark:text-paper/50">No test IDs yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ids.map((r) => (
            <li key={r.email} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm dark:border-white/10">
              <span className="min-w-0">
                <span className="font-mono font-semibold">{short(r.email)}</span>
                <span className="block truncate text-xs text-ink/50 dark:text-paper/50">
                  {r.email in inUse ? `Account made${inUse[r.email] ? ` · ${inUse[r.email]}` : ""}` : "No account yet"}
                </span>
              </span>
              <button onClick={() => void remove(r.email)} aria-label={`Remove ${short(r.email)}`} className="shrink-0 text-xs text-coral underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink/50 dark:text-paper/50">
        Test accounts count in the leaderboards like any other account. Use <strong>Clear data → Awards, rankings &amp; passports</strong> to wipe their ratings and badges before the event.
        Needs the Supabase file <code>supabase/v11_migration.sql</code>. If making a test account shows “Error sending confirmation email”,
        switch off <em>Confirm email</em> in Supabase → Authentication → Providers → Email.
      </p>
    </section>
  );
}
