"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "starting" | "scanning" | "denied" | "unsupported" | "error";

const ANDROID_OPEN_CAMERA = "intent://#Intent;action=android.media.action.STILL_IMAGE_CAMERA;end";

/**
 * Full-screen camera that reads a project's QR code inside the website, then opens that project.
 * Uses the phone's own barcode reader when the browser has one, and the jsQR library everywhere else
 * (iPhones). Needs the camera permission; if that's refused it explains how to use the Camera app instead.
 */
export default function QrScanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let lastNotice = 0;

    /** Turns scanned text into a project page on THIS site. Returns true if it was a KHOJ project code. */
    function handleCode(text: string): boolean {
      let url: URL;
      try {
        url = new URL(text.trim(), window.location.origin);
      } catch {
        return false;
      }
      if (!/^\/project\/[^/]+\/?$/.test(url.pathname)) {
        const now = Date.now();
        if (now - lastNotice > 2000) {
          lastNotice = now;
          setNotice("That isn't a KHOJ project QR code. Try the one on the project's table.");
        }
        return false;
      }
      // Always open the project on this site (never trust the address inside the code), keeping the ?scan=1 part.
      const target = `${url.pathname}${url.search}`;
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      onClose();
      router.push(target);
      return true;
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e: any) {
        setPhase(e?.name === "NotAllowedError" || e?.name === "SecurityError" || e?.name === "PermissionDeniedError" ? "denied" : "error");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      try {
        await video.play();
      } catch {
        setPhase("error");
        return;
      }
      setPhase("scanning");

      // Native reader where available (fast); otherwise the jsQR library.
      let detector: { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } | null = null;
      try {
        const Detector = (window as any).BarcodeDetector;
        if (Detector) detector = new Detector({ formats: ["qr_code"] });
      } catch {
        detector = null;
      }
      let jsQR: ((d: Uint8ClampedArray, w: number, h: number, o?: any) => { data: string } | null) | null = null;
      if (!detector) {
        const mod: any = await import("jsqr");
        jsQR = mod.default ?? mod;
      }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      let last = 0;
      const tick = async (time: number) => {
        if (stopped) return;
        if (time - last > 120 && video.readyState >= 2 && video.videoWidth > 0) {
          last = time;
          let text: string | null = null;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              text = codes[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          } catch {
            text = null;
          }
          if (text && handleCode(text)) return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFallback = phase === "denied" || phase === "unsupported" || phase === "error";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-paper">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h2 className="font-display text-base font-semibold">Scan a project QR code</h2>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
          Close
        </button>
      </div>

      {!showFallback ? (
        <div className="relative flex-1 overflow-hidden">
          <video ref={videoRef} muted playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" />
          {/* Viewfinder */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-64 w-64 max-w-[70vw] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-gold" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-gold" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-gold" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-gold" />
            </div>
          </div>
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 text-center text-sm">
            {phase === "starting" ? "Starting the camera… allow camera access if your phone asks." : notice ?? "Point the camera at the QR code on the project's table."}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="font-display text-lg font-semibold">
            {phase === "denied" ? "Camera access is blocked" : "The camera couldn't start here"}
          </p>
          <p className="mt-2 text-sm text-paper/80">
            {phase === "denied"
              ? "Allow the camera for this website: tap the lock or settings icon next to the web address, choose Camera → Allow, then press Scan QR again."
              : "This browser or app can't open the camera for websites. Open KHOJ in Chrome or Safari, or use your phone's Camera app as below."}
          </p>
          <p className="mt-5 text-sm font-semibold">Or scan with your phone's Camera app:</p>
          <ol className="mt-2 space-y-2 text-sm text-paper/85">
            <li>1. Open your phone's <strong>Camera</strong>.</li>
            <li>2. Point it at the QR code on the project's table.</li>
            <li>3. Tap the link that appears. The project opens and you can rate it and add its badge.</li>
            <li>4. Press <strong>Back</strong> to return to KHOJ.</li>
          </ol>
          {/android/i.test(typeof navigator === "undefined" ? "" : navigator.userAgent) && (
            <button
              type="button"
              onClick={() => {
                window.location.href = ANDROID_OPEN_CAMERA;
              }}
              className="mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink"
            >
              Open the Camera app
            </button>
          )}
        </div>
      )}
    </div>
  );
}
