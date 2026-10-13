import { redirect } from "next/navigation";

/** Complaints about services and vacancies now share one page. */
export default function ServiceComplaintsRedirect() {
  redirect("/admin/complaints?type=service_listing");
}
