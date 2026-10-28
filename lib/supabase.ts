// Browser Supabase client.
// Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
// (copy .env.example -> .env.local and fill in the values from your Supabase project's
// Settings -> API page).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Don't throw at import time when the env vars are missing — just warn. Anything that
  // calls `supabase` while these are unset will fail loudly at the call site,
  // which is easier to debug than a blank screen from a thrown module.
  if (typeof window !== "undefined") {
    console.warn(
      "[khoj] Supabase env vars are not set — no data will load. " +
        "See README > Connecting Supabase."
    );
  }
}

export const supabase = createClient(url ?? "", anonKey ?? "");

export const isSupabaseConfigured = Boolean(url && anonKey);
