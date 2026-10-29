"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function ProjectQrCode({ url, size = 180 }: { url: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 1,
      color: { dark: "#12172B", light: "#00000000" },
    }).catch(() => {});
  }, [url, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded-lg" aria-label={`QR code linking to ${url}`} />;
}
