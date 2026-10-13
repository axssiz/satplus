import "server-only";
import { ForbiddenError, requireStaff, type StaffRole } from "@/lib/auth";

export type AdminResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; details?: unknown };

/** Runs a staff action after re-checking the caller's role on the server. */
export async function guard<T>(role: StaffRole, fn: (userId: string) => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
  try {
    const user = await requireStaff(role);
    return await fn(user.id);
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Недостаточно прав" };
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Ошибка сервера";
    console.error("[admin]", e);
    return { ok: false, error: msg };
  }
}

export function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
