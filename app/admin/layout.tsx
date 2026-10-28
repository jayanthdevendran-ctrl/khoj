"use client";

import type { ReactNode } from "react";
import { DataProvider } from "@/lib/data-store";

// The admin pages (Projects, etc.) read their data through DataProvider.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}
