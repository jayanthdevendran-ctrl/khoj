// Helpers for the one-time "allow camera and compass" prompt shown after sign-in on phones.

export const PERMISSIONS_ASKED_KEY = "khoj:permissions:asked";

/** True on phones and tablets (the only devices that scan QR codes or have a compass). */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** iPhones and iPads only let a website read the compass after the person taps "Allow". */
export function compassNeedsTap(): boolean {
  if (typeof window === "undefined") return false;
  const DOE = (window as any).DeviceOrientationEvent;
  return Boolean(DOE && typeof DOE.requestPermission === "function");
}

export function compassAlreadyGranted(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__khojCompassGranted);
}

/** Tells the compass on the Passport that it can start now (no second tap needed). */
export function markCompassGranted() {
  (window as any).__khojCompassGranted = true;
  window.dispatchEvent(new Event("khoj:compass-granted"));
}

/** "granted" | "denied" | "prompt" | "unknown" (older Safari can't be asked). */
export async function cameraPermissionState(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return "denied"; // this browser can't open a camera for websites
    const status = await (navigator.permissions as any)?.query({ name: "camera" });
    return (status?.state as "granted" | "denied" | "prompt") ?? "unknown";
  } catch {
    return "unknown";
  }
}
