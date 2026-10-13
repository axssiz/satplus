import "server-only";
import { cache } from "react";
import { createSupabasePublicClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmploymentType, ExperienceLevel } from "@/lib/validation";
import { DataError } from "./catalog";

export type JobCategory = { id: string; slug: string; nameRu: string; nameKk: string; icon: string };

export type JobListItem = {
  id: string;
  slug: string;
  title: string;
  employerName: string;
  employmentType: EmploymentType;
  experience: ExperienceLevel;
  schedule: string | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  address: string | null;
  isSponsored: boolean;
  publishedAt: string | null;
  categorySlug: string | null;
};

export type JobListing = JobListItem & {
  salaryNote: string | null;
  description: string;
  contactName: string | null;
  phone: string;
  hasWhatsapp: boolean;
  email: string | null;
  linkUrl: string | null;
  sourceName: string | null;
  expiresOn: string;
  updatedAt: string;
};

export type JobStatus = "pending" | "published" | "rejected" | "archived";

export type MyJobListing = Omit<JobListing, "isSponsored" | "publishedAt" | "categorySlug" | "sourceName" | "expiresOn" | "updatedAt"> & {
  status: JobStatus;
  rejectReason: string | null;
  expiresOn: string | null;
  createdAt: string;
  categoryId: string | null;
};

export const JOBS_PAGE_SIZE = 24;

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[data] ${what}:`, res.error.message);
    throw new DataError(`Failed to load ${what}`, res.error);
  }
  return res.data as T;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));
const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function mapListItem(r: Row): JobListItem {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    employerName: String(r.employer_name),
    employmentType: r.employment_type as EmploymentType,
    experience: r.experience as ExperienceLevel,
    schedule: str(r.schedule),
    salaryFrom: num(r.salary_from),
    salaryTo: num(r.salary_to),
    address: str(r.address),
    isSponsored: Boolean(r.is_sponsored),
    publishedAt: str(r.published_at),
    categorySlug: str(r.category_slug),
  };
}

function mapDetails(r: Row) {
  return {
    salaryNote: str(r.salary_note),
    description: String(r.description),
    contactName: str(r.contact_name),
    phone: String(r.phone),
    hasWhatsapp: Boolean(r.has_whatsapp),
    email: str(r.email),
    linkUrl: str(r.link_url),
  };
}

export const getJobCategories = cache(async (): Promise<JobCategory[]> => {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("job_categories").select("id, slug, name_ru, name_kk, icon").order("sort_order"), "job categories");
  return rows.map((c) => ({ id: String(c.id), slug: String(c.slug), nameRu: String(c.name_ru), nameKk: String(c.name_kk), icon: String(c.icon) }));
});

export type JobFilters = {
  q?: string;
  category?: string;
  employment?: EmploymentType;
  withSalary?: boolean;
  noExperience?: boolean;
  page?: number;
  pageSize?: number;
};

export async function searchJobListings(opts: JobFilters) {
  const pageSize = opts.pageSize ?? JOBS_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const db = createSupabasePublicClient();
  const rows = check(
    await db.rpc("search_job_listings", {
      p_query: opts.q?.trim().slice(0, 100) || null,
      p_category: opts.category || null,
      p_employment: opts.employment || null,
      p_with_salary: !!opts.withSalary,
      p_no_experience: !!opts.noExperience,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    "job listings",
  ) as Row[];
  return {
    items: rows.map(mapListItem),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export const getJobListingBySlug = cache(async (slug: string): Promise<JobListing | null> => {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  const db = createSupabasePublicClient();
  // RLS returns only published, unexpired vacancies to the public client.
  const row = check(
    await db
      .from("job_listings")
      .select(
        "id, slug, title, employer_name, employment_type, experience, schedule, salary_from, salary_to, salary_note, description, address, contact_name, phone, has_whatsapp, email, link_url, source_name, is_sponsored, published_at, expires_on, updated_at, job_categories(slug)",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "job listing",
  ) as Row | null;
  if (!row) return null;
  const cat = first(row.job_categories as Row | Row[] | null);
  return {
    ...mapListItem({ ...row, category_slug: cat?.slug ?? null }),
    ...mapDetails(row),
    sourceName: str(row.source_name),
    expiresOn: String(row.expires_on),
    updatedAt: String(row.updated_at),
  };
});

export async function getAllJobSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("job_listings").select("slug, updated_at").order("published_at", { ascending: false }).limit(5000), "job slugs");
  return rows.map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}

/** The signed-in employer's own vacancies in every state (RLS: owner_id = auth.uid()). */
export async function getMyJobListings(userId: string): Promise<MyJobListing[]> {
  const db = await createSupabaseServerClient();
  const rows = check(
    await db
      .from("job_listings")
      .select(
        "id, slug, title, status, reject_reason, expires_on, created_at, category_id, employer_name, employment_type, experience, schedule, salary_from, salary_to, salary_note, description, address, contact_name, phone, has_whatsapp, email, link_url",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    "my job listings",
  ) as Row[];
  return rows.map((r) => {
    const base = mapListItem(r);
    return {
      id: base.id,
      slug: base.slug,
      title: base.title,
      employerName: base.employerName,
      employmentType: base.employmentType,
      experience: base.experience,
      schedule: base.schedule,
      salaryFrom: base.salaryFrom,
      salaryTo: base.salaryTo,
      address: base.address,
      ...mapDetails(r),
      status: r.status as JobStatus,
      rejectReason: str(r.reject_reason),
      expiresOn: str(r.expires_on),
      createdAt: String(r.created_at),
      categoryId: str(r.category_id),
    };
  });
}
