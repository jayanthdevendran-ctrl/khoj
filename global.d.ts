declare module "*.css";

// Types for the in-page QR scanner library (jsQR). Declared here so the project type-checks even before
// `npm install` has fetched the package; the real package provides the same API.
declare module "jsqr" {
  export interface QRCode {
    data: string;
  }
  export interface Options {
    inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst";
  }
  export default function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: Options): QRCode | null;
}
