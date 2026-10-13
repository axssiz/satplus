import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Magic-link landing: exchanges the one-time code for a session cookie. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/account";
  const next = /^\/[a-zA-Z0-9/_-]*$/.test(nextParam) && !nextParam.startsWith("//") ? nextParam : "/account";
  if (code) {
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth/callback]", error.message);
  }
  return NextResponse.redirect(new URL("/account?error=link", url.origin));
}
