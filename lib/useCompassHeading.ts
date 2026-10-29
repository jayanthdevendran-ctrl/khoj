"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live compass heading of the phone, in degrees: 0 = north, 90 = east, 180 = south, 270 = west.
 *
 *  - iPhone: uses Safari's built-in compass value. Safari only allows this after a tap, so
 *    `needsPermission` is true until `requestPermission()` is called from a button press.
 *  - Android: uses the absolute orientation sensor (works without a prompt).
 *
 * The heading is the direction the TOP of the phone points when it's held flat, and the direction the
 * back camera faces when it's held upright. It's smoothed so the dial doesn't jitter.
 */
export function useCompassHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [denied, setDenied] = useState(false);
  const [noSensor, setNoSensor] = useState(false);
  const smooth = useRef<{ x: number; y: number } | null>(null);
  const started = useRef(false);
  const gotReading = useRef(false);

  const push = useCallback((deg: number) => {
    gotReading.current = true;
    const rad = (deg * Math.PI) / 180;
    const next = { x: Math.cos(rad), y: Math.sin(rad) };
    // Smooth on the unit circle so 359° -> 1° doesn't swing the long way round.
    const prev = smooth.current;
    const k = 0.25;
    smooth.current = prev ? { x: prev.x + (next.x - prev.x) * k, y: prev.y + (next.y - prev.y) * k } : next;
    const out = (Math.atan2(smooth.current.y, smooth.current.x) * 180) / Math.PI;
    setHeading((out + 360) % 360);
  }, []);

  const onOrientation = useCallback(
    (e: DeviceOrientationEvent) => {
      // iPhone: Safari already gives a tilt-corrected compass heading.
      const ios = (e as any).webkitCompassHeading;
      if (typeof ios === "number" && !Number.isNaN(ios)) {
        push(ios);
        return;
      }
      if (e.alpha == null) return;
      // Only trust alpha when it is measured against north (absolute).
      if (e.type === "deviceorientation" && !e.absolute) return;

      const alpha = e.alpha;
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const rad = Math.PI / 180;
      let deg: number;
      if (Math.abs(beta) < 50 && Math.abs(gamma) < 50) {
        // Held roughly flat: heading of the top edge of the phone.
        const screenAngle = (screen.orientation?.angle ?? (window as any).orientation ?? 0) as number;
        deg = (360 - alpha + screenAngle + 360) % 360;
      } else {
        // Held upright (like when scanning): direction the back camera faces (W3C compass formula).
        const cY = Math.cos(gamma * rad);
        const cZ = Math.cos(alpha * rad);
        const sX = Math.sin(beta * rad);
        const sY = Math.sin(gamma * rad);
        const sZ = Math.sin(alpha * rad);
        const vx = -cZ * sY - sZ * sX * cY;
        const vy = -sZ * sY + cZ * sX * cY;
        deg = (Math.atan2(vx, vy) * 180) / Math.PI;
        deg = (deg + 360) % 360;
      }
      push(deg);
    },
    [push]
  );

  const listen = useCallback(() => {
    if (started.current) return;
    started.current = true;
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
    window.addEventListener("deviceorientation", onOrientation as EventListener, true);
    // No readings after a couple of seconds means this device has no compass (a laptop, for example).
    window.setTimeout(() => {
      if (!gotReading.current) setNoSensor(true);
    }, 2500);
  }, [onOrientation]);

  /** Call from a button press (required by iPhone). Resolves true if the compass is now allowed. */
  const requestPermission = useCallback(async () => {
    const DOE = (window as any).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      try {
        const result = await DOE.requestPermission();
        if (result === "granted") {
          setNeedsPermission(false);
          setDenied(false);
          listen();
          return true;
        }
        setDenied(true);
        return false;
      } catch {
        setDenied(true);
        return false;
      }
    }
    listen();
    return true;
  }, [listen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) {
      setNoSensor(true);
      return;
    }
    const DOE = (window as any).DeviceOrientationEvent;
    const onGranted = () => {
      setNeedsPermission(false);
      listen();
    };
    window.addEventListener("khoj:compass-granted", onGranted);
    if (DOE && typeof DOE.requestPermission === "function") {
      if ((window as any).__khojCompassGranted) listen(); // already allowed from the sign-in prompt
      else setNeedsPermission(true); // iPhone: wait for a tap
    } else {
      listen();
    }
    return () => {
      window.removeEventListener("khoj:compass-granted", onGranted);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener, true);
      window.removeEventListener("deviceorientation", onOrientation as EventListener, true);
      started.current = false;
    };
  }, [listen, onOrientation]);

  return { heading, needsPermission, denied, noSensor, requestPermission };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export function cardinal(deg: number): string {
  return POINTS[Math.round(deg / 22.5) % 16]!;
}
