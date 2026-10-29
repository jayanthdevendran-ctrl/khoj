"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Redirects to /admin unless there's a real, logged-in Supabase session
 * AND that user's id is in the admin_users table. Use this at the top of
 * every page under /admin/* except /admin itself (the login page).
 *
 * Returns `ready`: only render the page's content once this is true, to
 * avoid a flash of protected content before the check finishes.
 */
export function useAdminGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.replace("/admin");
        return;
      }
      const { data: adminRow } = await supabase.from("admin_users").select("id").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      if (!adminRow) {
        router.replace("/admin");
        return;
      }
      setReady(true);
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return ready;
}
