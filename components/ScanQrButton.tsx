"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import QrScanner from "@/components/QrScanner";

/** Floating "Scan QR" button on phones. Opens an in-page camera that reads the project's QR code. */
export default function ScanQrButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Not needed on admin pages.
  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan a QR code"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full bg-gold px-5 py-3.5 text-sm font-semibold text-ink shadow-card md:hidden"
      >
        <span aria-hidden className="text-lg">▣</span>
        Scan QR
      </button>
      {open && <QrScanner onClose={() => setOpen(false)} />}
    </>
  );
}
