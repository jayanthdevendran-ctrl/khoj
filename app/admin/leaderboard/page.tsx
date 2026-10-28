import { redirect } from "next/navigation";

// Visitors now live in a tab on the admin dashboard.
export default function AdminVisitorsPage() {
  redirect("/admin/dashboard#visitors");
}
