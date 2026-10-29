"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/** A random password that is easy to read out loud: no look-alike characters, with upper, lower, digits and a symbol. */
function suggestPassword(): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0]! % chars.length]!;
  const out = sets.map(pick);
  while (out.length < 14) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.join("");
}

function strength(pw: string): { label: string; color: string } {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (!pw) return { label: "", color: "" };
  if (score <= 2) return { label: "Weak", color: "text-coral" };
  if (score <= 3) return { label: "OK", color: "text-gold" };
  return { label: "Strong", color: "text-teal-soft" };
}

type Note = { kind: "ok" | "error"; text: string } | null;

export default function PasswordsPanel() {
  // ---- reset someone else's password ----
  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  async function reset() {
    const mail = email.trim().toLowerCase();
    if (!mail.includes("@")) return setNote({ kind: "error", text: "Type the person's full email address." });
    if (newPw.length < 8) return setNote({ kind: "error", text: "The new password needs at least 8 characters." });
    if (!window.confirm(`Set a new password for ${mail}? Their old password will stop working and they will be signed out.`)) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.rpc("admin_set_password", { p_email: mail, p_password: newPw });
    setBusy(false);
    if (error) {
      const missing = /admin_set_password|schema cache|could not find the function/i.test(error.message);
      setNote({ kind: "error", text: missing ? "This isn't switched on yet — run supabase/v15_migration.sql in the Supabase SQL editor first." : error.message });
      return;
    }
    setNote({ kind: "ok", text: `Done. ${mail} can now sign in with the new password. Give it to them privately.` });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote({ kind: "ok", text: "Copied to the clipboard." });
    } catch {
      setNote({ kind: "error", text: "Couldn't copy automatically — select the password and copy it." });
    }
  }

  // ---- change my own password ----
  const [mine, setMine] = useState("");
  const [mine2, setMine2] = useState("");
  const [showMine, setShowMine] = useState(false);
  const [myBusy, setMyBusy] = useState(false);
  const [myNote, setMyNote] = useState<Note>(null);
  const s = strength(mine);

  async function changeMine() {
    setMyNote(null);
    if (mine.length < 10) return setMyNote({ kind: "error", text: "Use at least 10 characters for an admin password." });
    if (!(/[a-zA-Z]/.test(mine) && /\d/.test(mine))) return setMyNote({ kind: "error", text: "Mix letters and numbers (adding a symbol makes it stronger)." });
    if (mine !== mine2) return setMyNote({ kind: "error", text: "The two passwords don't match." });
    setMyBusy(true);
    const { error } = await supabase.auth.updateUser({ password: mine });
    setMyBusy(false);
    if (error) {
      const needsLogin = /reauth|recent|nonce/i.test(error.message);
      const same = /different from the old|same as/i.test(error.message);
      setMyNote({
        kind: "error",
        text: needsLogin
          ? "For safety, Supabase wants a fresh sign-in first. Sign out, sign in again, open this tab and try once more."
          : same
          ? "That's the same as your current password — choose a new one."
          : error.message,
      });
      return;
    }
    setMine("");
    setMine2("");
    setMyNote({ kind: "ok", text: "Your admin password has been changed. Use it next time you sign in." });
  }

  const inputCls = "mt-1 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm dark:border-white/20 dark:bg-white/5";
  const noteCls = (n: NonNullable<Note>) => `mt-3 rounded-lg px-4 py-3 text-sm ${n.kind === "ok" ? "bg-teal-soft text-teal-deep" : "bg-coral-soft text-coral"}`;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl2 border border-line p-4 dark:border-white/10">
        <h2 className="font-display text-lg font-semibold">Reset someone’s password</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
          Type the person’s email and a new password. It works straight away and signs them out of their other devices. Passwords can’t be read back later, so give the new one to them privately.
        </p>
        <label className="mt-4 block text-sm font-medium">
          Email address
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. name@npskrm.com" autoComplete="off" className={inputCls} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          New password
          <div className="mt-1 flex gap-2">
            <input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" autoComplete="off" className="w-full rounded-lg border border-line bg-transparent px-3 py-2 font-mono text-sm dark:border-white/20 dark:bg-white/5" />
            <button type="button" onClick={() => setNewPw(suggestPassword())} className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-semibold dark:border-white/20">
              Suggest
            </button>
            <button type="button" onClick={() => void copy(newPw)} disabled={!newPw} className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-white/20">
              Copy
            </button>
          </div>
        </label>
        <button type="button" onClick={() => void reset()} disabled={busy} className="mt-4 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40">
          {busy ? "Resetting…" : "Reset password"}
        </button>
        {note && <p role="status" className={noteCls(note)}>{note.text}</p>}
        <p className="mt-3 text-xs text-ink/50 dark:text-paper/50">
          Works for any account except other admins (each admin changes their own). Needs <code>supabase/v15_migration.sql</code>.
        </p>
      </section>

      <section className="rounded-xl2 border border-line p-4 dark:border-white/10">
        <h2 className="font-display text-lg font-semibold">Change my own admin password</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">Pick a long password you don’t use anywhere else — a password manager is ideal.</p>
        <label className="mt-4 block text-sm font-medium">
          New password
          <div className="relative">
            <input type={showMine ? "text" : "password"} value={mine} onChange={(e) => setMine(e.target.value)} autoComplete="new-password" className={`${inputCls} pr-16`} />
            <button type="button" onClick={() => setShowMine((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-semibold text-gold">
              {showMine ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {s.label && <p className={`mt-1 text-xs font-semibold ${s.color}`}>Strength: {s.label}</p>}
        <label className="mt-3 block text-sm font-medium">
          Type it again
          <input type={showMine ? "text" : "password"} value={mine2} onChange={(e) => setMine2(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void changeMine()} disabled={myBusy} className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40">
            {myBusy ? "Saving…" : "Change my password"}
          </button>
          <button
            type="button"
            onClick={() => {
              const p = suggestPassword();
              setMine(p);
              setMine2(p);
              setShowMine(true);
            }}
            className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold dark:border-white/20"
          >
            Suggest a strong one
          </button>
        </div>
        {myNote && <p role="status" className={noteCls(myNote)}>{myNote.text}</p>}
        <p className="mt-3 text-xs text-ink/50 dark:text-paper/50">If you use “Suggest”, copy it or save it in your password manager before pressing Change.</p>
      </section>
    </div>
  );
}
