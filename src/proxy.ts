import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function toLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/account";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const response = isAdmin ? NextResponse.next({ request }) : intl(request);

  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie || !SUPABASE_URL || !SUPABASE_KEY) {
    // Fast path for anonymous visitors: no auth round-trip.
    return isAdmin ? toLogin(request) : response;
  }

  // Refresh the Supabase session cookies (tokens expire hourly).
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Role checks happen on the server in the admin layout and in every admin action.
  if (isAdmin && !user) return toLogin(request);
  if (isAdmin) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!api|auth|icons|icon|apple-icon|_next|_vercel|.*\\..*).*)"],
};
