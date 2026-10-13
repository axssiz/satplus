import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffRole = "moderator" | "admin";

export type CurrentUser = {
  id: string;
  email: string | null;
  roles: StaffRole[];
  isModerator: boolean;
  isAdmin: boolean;
};

/** The signed-in user (verified with Supabase Auth), or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map((r) => r.role as StaffRole);
  const isAdmin = roles.includes("admin");
  return { id: user.id, email: user.email ?? null, roles, isAdmin, isModerator: isAdmin || roles.includes("moderator") };
});

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}

/** Server-side guard for staff actions. Throws if the caller lacks the role. */
export async function requireStaff(role: StaffRole = "moderator"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  if (role === "admin" ? !user.isAdmin : !user.isModerator) throw new ForbiddenError();
  return user;
}
