"use client";

import { useEffect, useState } from "react";
import { useVisitor } from "@/lib/visitor-store";
import { PERMISSIONS_ASKED_KEY, cameraPermissionState, compassAlreadyGranted, compassNeedsTap, isTouchDevice, markCompassGranted } from "@/lib/permissions";

type Needs = { camera: boolean; compass: boolean };

/**
 * Shown once per phone, right after signing in: asks for the camera (to scan project QR codes) and, on iPhones,
 * for motion access (to turn the Passport compass). Only asks for what this phone actually needs.
 */
export default function PermissionsPrompt() {
  const { needsFullName } = useVisitor();
  const [needs, setNeeds] = useState<Needs | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTouchDevice()) return; // laptops don't scan codes or have a compass
      try {
        if (window.localStorage.getItem(PERMISSIONS_ASKED_KEY)) return; // already asked on this phone
      } catch {}
      const camState = await cameraPermissionState();
      const wanted: Needs = { camera: camState === "prompt" || camState === "unknown", compass: compassNeedsTap() && !compassAlreadyGranted() };
      if (!cancelled && (wanted.camera || wanted.compass)) setNeeds(wanted);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needs || needsFullName) return null; // wait until the full-name question (if any) is done

  function finish() {
    try {
      window.localStorage.setItem(PERMISSIONS_ASKED_KEY, "1");
    } catch {}
    setNeeds(null);
  }

  async function allow() {
    if (!needs) return;
    setBusy(true);
    setProblem(null);
    const issues: string[] = [];
    // The compass question must come first: iPhones only accept it straight after a tap.
    if (needs.compass) {
      try {
        const answer = await (window as any).DeviceOrientationEvent.requestPermission();
        if (answer === "granted") markCompassGranted();
        else issues.push("compass");
      } catch {
        issues.push("compass");
      }
    }
    if (needs.camera) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        stream.getTracks().forEach((t) => t.stop()); // we only wanted the permission, not the picture
      } catch {
        issues.push("camera");
      }
    }
    setBusy(false);
    try {
      window.localStorage.setItem(PERMISSIONS_ASKED_KEY, "1");
    } catch {}
    if (issues.length === 0) {
      setNeeds(null);
      return;
    }
    setProblem(
      `${issues.includes("camera") ? "The camera" : "The compass"}${issues.length > 1 ? " and the compass were" : " was"} not allowed. You can allow ${
        issues.length > 1 ? "them" : "it"
      } later in your browser or phone settings for this site. Until then, scanning may not work.`
    );
    setNeeds({ camera: false, compass: false });
  }

  const nothingLeft = !needs.camera && !needs.compass;

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Allow camera and compass">
      <div className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-card dark:bg-[#0d2252]">
        {nothingLeft ? (
          <>
            <h2 className="font-display text-xl font-bold">Almost there</h2>
            <p className="mt-2 text-sm text-ink/70 dark:text-paper/70">{problem}</p>
            <button type="button" onClick={finish} className="mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink">
              OK
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold">Allow camera{needs.compass ? " and compass" : ""}?</h2>
            <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">KHOJ needs {needs.compass ? "these" : "this"} to scan project QR codes. Your phone will ask next.</p>
            <ul className="mt-4 space-y-3 text-sm">
              {needs.camera && (
                <li className="flex gap-3">
                  <span aria-hidden className="text-xl">📷</span>
                  <span>
                    <strong>Camera</strong> — to read the QR code on each project’s table.
                  </span>
                </li>
              )}
              {needs.compass && (
                <li className="flex gap-3">
                  <span aria-hidden className="text-xl">🧭</span>
                  <span>
                    <strong>Motion &amp; orientation</strong> — to turn the compass on your Passport and show which way you’re facing.
                  </span>
                </li>
              )}
            </ul>
            <p className="mt-4 rounded-lg bg-mist p-3 text-xs text-ink/70 dark:bg-white/10 dark:text-paper/70">
              Your camera is only used on your phone to read QR codes. KHOJ doesn’t record, save or send any photos or video, and doesn’t use your location. You can change this any time in your browser settings.
            </p>
            <button type="button" onClick={() => void allow()} disabled={busy} className="mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50">
              {busy ? "Waiting for your phone…" : "Allow"}
            </button>
            <button type="button" onClick={finish} disabled={busy} className="mt-2 w-full rounded-full px-5 py-2.5 text-sm text-ink/60 underline dark:text-paper/60">
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
