"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { JOB_ICON_NAMES } from "@/components/icons";
import { fail, guard, type AdminResult } from "@/lib/server/admin-guard";
import { createSupabaseServerClient, PUBLIC_DATA_TAG } from "@/lib/supabase/server";
import { staffJobListingSchema } from "@/lib/validation";

function refreshJobs() {
  revalidatePath("/", "layout");
  // Cached Supabase reads are shared between pages; expire them so every page sees the change.
  updateTag(PUBLIC_DATA_TAG);
}

/** Approve a pending vacancy (live for 30 days) or reject it with a reason the employer will see. */
export async function moderateJobListing(id: string, action: "approve" | "reject", reason?: string): Promise<AdminResult> {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    const r = action === "reject" ? z.string().trim().min(2, "Укажите причину").max(300).parse(reason ?? "") : null;
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("staff_moderate_job_listing", { p_id: id, p_action: action, p_reason: r });
    if (error?.message.includes("already moderated")) return { ok: false, error: "Вакансия уже проверена" };
    fail(error);
    refreshJobs();
    revalidatePath("/admin", "layout");
    return { ok: true, message: action === "approve" ? "Вакансия опубликована" : "Вакансия отклонена" };
  });
}

/** Staff create a vacancy from a verified source or correct any vacancy. */
export async function saveJobListingStaff(formData: FormData): Promise<AdminResult<{ id: string }>> {
  return guard<{ id: string }>("moderator", async () => {
    const parsed = staffJobListingSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
    const v = parsed.data;
    if (!v.id && !v.sourceName) return { ok: false, error: "Укажите источник: откуда известна вакансия" };
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc("staff_save_job_listing", {
      p: {
        id: v.id ?? "",
        slug: v.slug,
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
        source_name: v.sourceName ?? "",
        status: v.status,
        expires_on: v.expiresOn ?? "",
        is_sponsored: v.isSponsored,
      },
    });
    if (error?.code === "23505") return { ok: false, error: "Вакансия с таким слагом уже есть — измените адрес страницы" };
    if (error?.code === "23514") return { ok: false, error: "Проверьте телефон, почту, ссылку, зарплату и источник" };
    fail(error);
    refreshJobs();
    revalidatePath("/admin", "layout");
    return { ok: true, data: { id: String(data) }, message: "Вакансия сохранена" };
  });
}

export async function deleteJobListingStaff(id: string): Promise<AdminResult> {
  return guard("admin", async () => {
    z.uuid().parse(id);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("staff_delete_job_listing", { p_id: id });
    fail(error);
    refreshJobs();
    return { ok: true, message: "Вакансия удалена" };
  });
}

const categorySchema = z.object({
  id: z
    .union([z.literal(""), z.uuid()])
    .optional()
    .transform((v) => (v ? v : undefined)),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,64}$/, "Слаг: латиница, цифры, дефис"),
  name_ru: z.string().trim().min(2).max(60),
  name_kk: z.string().trim().min(2).max(60),
  icon: z.string().refine((v) => JOB_ICON_NAMES.includes(v), "Выберите иконку из списка"),
  sort_order: z.coerce.number().int().min(0).max(10000).default(100),
  is_active: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
});

export async function saveJobCategory(formData: FormData): Promise<AdminResult> {
  return guard("admin", async () => {
    const parsed = categorySchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
    const { id, ...row } = parsed.data;
    const db = await createSupabaseServerClient();
    const { error } = id ? await db.from("job_categories").update(row).eq("id", id) : await db.from("job_categories").insert(row);
    if (error?.code === "23505") return { ok: false, error: "Такой слаг уже есть" };
    fail(error);
    refreshJobs();
    return { ok: true, message: "Категория сохранена" };
  });
}
