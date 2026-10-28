"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live device compass heading, 0-360 degrees, 0 = north.
 *
 * iOS Safari requires a user gesture before it will grant motion/orientation
 * permission, so this hook exposes `requestPermission()` — call it from an
 * onClick handler (e.g. a "Enable compass" button) rather than on mount.
 * Android/Chrome doesn't need this and starts listening automatically.
 */
export function useCompassHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState(true);
  const [needsPermission, setNeedsPermission] = useState(false);
  const listening = useRef(false);

  function handleOrientation(e: DeviceOrientationEvent) {
    // iOS exposes webkitCompassHeading directly (0 = north, clockwise).
    const webkitHeading = (e as any).webkitCompassHeading;
    if (typeof webkitHeading === "number") {
      setHeading(webkitHeading);
      return;
    }
    // Standard DeviceOrientationEvent: alpha is rotation around z, but its
    // zero-point is arbitrary unless `absolute` is true. Best-effort fallback.
    if (e.absolute && e.alpha != null) {
      setHeading(360 - e.alpha);
    }
  }

  function start() {
    if (listening.current || typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setSupported(false);
      return;
    }
    window.addEventListener("deviceorientation", handleOrientation, true);
    listening.current = true;
  }

  async function requestPermission() {
    const DOE = (window as any).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      try {
        const result = await DOE.requestPermission();
        if (result === "granted") {
          setNeedsPermission(false);
          start();
        }
      } catch {
        setSupported(false);
      }
      return;
    }
    // Non-iOS: no permission step needed.
    start();
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const DOE = (window as any).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      // iOS 13+: must wait for a user gesture.
      setNeedsPermission(true);
      return;
    }
    start();
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      listening.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { heading, supported, needsPermission, requestPermission };
}
