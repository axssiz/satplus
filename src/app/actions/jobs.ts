"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { isFeatureEnabled } from "@/config/features";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/news/text";
import { fileListingComplaint } from "@/lib/server/listing-complaints";
import { createSupabaseServerClient, PUBLIC_DATA_TAG } from "@/lib/supabase/server";
import { jobListingSchema } from "@/lib/validation";

export type JobActionError =
  | "validation"
  | "auth"
  | "activeLimit"
  | "dailyLimit"
  | "notFound"
  | "renewTooEarly"
  | "rateLimited"
  | "duplicate"
  | "server";

export type JobActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: JobActionError; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

/** Maps the RAISE messages of the database functions to form errors. */
function dbError(message: string | undefined): JobActionError | null {
  if (!message) return null;
  if (message.includes("job_active_limit")) return "activeLimit";
  if (message.includes("job_daily_limit")) return "dailyLimit";
  if (message.includes("job_renew_too_early")) return "renewTooEarly";
  if (message.includes("job_wrong_state")) return "validation";
  if (message.includes("not found")) return "notFound";
  if (message.includes("not authenticated")) return "auth";
  return null;
}

function refresh() {
  revalidatePath("/", "layout");
  updateTag(PUBLIC_DATA_TAG);
}

/** A signed-in employer submits a new vacancy or edits their own (both go to moderation). */
export async function saveJobListing(formData: FormData): Promise<JobActionResult<{ id: string }>> {
  if (!isFeatureEnabled("jobs")) return { ok: false, error: "notFound" };
  const get = (k: string) => formData.get(k) ?? undefined;
  const parsed = jobListingSchema.safeParse({
    id: get("id"),
    categoryId: get("categoryId"),
    title: get("title"),
    employerName: get("employerName"),
    employmentType: get("employmentType"),
    experience: get("experience"),
    schedule: get("schedule"),
    salaryFrom: get("salaryFrom"),
    salaryTo: get("salaryTo"),
    salaryNote: get("salaryNote"),
    description: get("description"),
    address: get("address"),
    contactName: get("contactName"),
    phone: get("phone"),
    hasWhatsapp: get("hasWhatsapp"),
    email: get("email"),
    linkUrl: get("linkUrl"),
    consent: get("consent"),
  });
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const v = parsed.data;

  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "auth" };
    const db = await createSupabaseServerClient();
    const payload = {
      slug: slugify(v.title, 100) || "vakansiya",
      category_id: v.categoryId,
      title: v.title,
      employer_name: v.employerName,
      employment_type: v.employmentType,
      experience: v.experience,
      schedule: v.schedule ?? "",
      salary_from: v.salaryFrom ?? "",
      salary_to: v.salaryTo ?? "",
      salary_note: v.salaryNote ?? "",
      description: v.description,
      address: v.address ?? "",
      contact_name: v.contactName ?? "",
      phone: v.phone,
      has_whatsapp: v.hasWhatsapp,
      email: v.email ?? "",
      link_url: v.linkUrl ?? "",
    };
    const { data, error } = v.id
      ? await db.rpc("update_my_job_listing", { p_id: v.id, p: payload })
      : await db.rpc("submit_job_listing", { p: payload });
    if (error) {
      const mapped = dbError(error.message);
      if (mapped) return { ok: false, error: mapped };
      if (error.code === "23514") return { ok: false, error: "validation" };
      throw error;
    }
    refresh();
    return { ok: true, data: { id: v.id ?? String(data) } };
  } catch (e) {
    console.error("[saveJobListing]", e);
    return { ok: false, error: "server" };
  }
}

/** Employer actions from «Мои вакансии». */
export async function myJobListingAction(id: string, action: "archive" | "restore" | "renew" | "delete"): Promise<JobActionResult> {
  if (!z.uuid().safeParse(id).success || !["archive", "restore", "renew", "delete"].includes(action)) return { ok: false, error: "validation" };
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "auth" };
    const db = await createSupabaseServerClient();
    const { error } =
      action === "delete"
        ? await db.rpc("delete_my_job_listing", { p_id: id })
        : await db.rpc("my_job_listing_action", { p_id: id, p_action: action });
    if (error) {
      const mapped = dbError(error.message);
      if (mapped) return { ok: false, error: mapped };
      throw error;
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[myJobListingAction]", e);
    return { ok: false, error: "server" };
  }
}

/** Anyone can report a live vacancy; moderators review complaints in the admin panel. */
export async function reportJobListing(formData: FormData): Promise<JobActionResult> {
  if (!isFeatureEnabled("jobs")) return { ok: false, error: "notFound" };
  return fileListingComplaint(formData, "job_listing", "reportJobListing");
}
