import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type StaffRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Every admin page re-checks the role on the server (layouts are not a security boundary)
 * and reads through the caller's own session, so RLS applies as well.
 */
export async function adminPage(role: StaffRole = "moderator") {
  const user = await getCurrentUser();
  if (!user || !user.isModerator) redirect("/account?next=/admin");
  if (role === "admin" && !user.isAdmin) redirect("/admin");
  const db = await createSupabaseServerClient();
  return { user, db };
}

export type ProductOption = { id: string; slug: string; name_ru: string };
export type BranchOption = { id: string; slug: string; name: string; store_name: string; is_demo: boolean };

export function one<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export const fmtMoney = (n: number | string | null | undefined) =>
  n == null ? "—" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(n))} ₸`;

export const fmtDate = (iso: string | null | undefined, withTime = true) =>
  iso
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "Asia/Almaty",
      }).format(new Date(iso))
    : "—";

export async function loadBranches(db: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<BranchOption[]> {
  const { data, error } = await db
    .from("store_branches")
    .select("id, slug, name, stores!inner(name, is_demo, sort_order)")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((b) => {
      const s = one<{ name: string; is_demo: boolean; sort_order: number }>(b.stores);
      return { id: String(b.id), slug: String(b.slug), name: String(b.name), store_name: s?.name ?? "", is_demo: !!s?.is_demo };
    })
    .sort((a, b) => a.store_name.localeCompare(b.store_name, "ru") || a.name.localeCompare(b.name, "ru"));
}

const UNIT_RU: Record<string, string> = { g: "г", kg: "кг", ml: "мл", l: "л", pcs: "шт" };
export const unitRu = (u: unknown) => UNIT_RU[String(u)] ?? String(u ?? "");
