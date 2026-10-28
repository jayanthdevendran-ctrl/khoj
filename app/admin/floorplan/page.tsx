import { redirect } from "next/navigation";

// Floor plan uploads now live on the main admin dashboard.
export default function FloorplanAdminPage() {
  redirect("/admin/dashboard#floorplans");
}
