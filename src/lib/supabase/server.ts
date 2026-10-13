import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ConfigurationError, isSupabaseConfigured, publicEnv } from "@/lib/env";

function assertConfigured() {
  if (!isSupabaseConfigured()) {
    throw new ConfigurationError("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
}

/** Per-request client bound to the visitor's auth cookies. RLS applies as that user. */
export async function createSupabaseServerClient() {
  assertConfigured();
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by the proxy instead.
        }
      },
    },
  });
}

/**
 * Tag on every public read. Staff edits call `updateTag(PUBLIC_DATA_TAG)` so cached pages
 * (ISR) pick up the change on the next visit instead of after their revalidate window.
 */
export const PUBLIC_DATA_TAG = "public-data";

/** Cookie-less anonymous client for public catalog reads (cache-friendly). */
export function createSupabasePublicClient() {
  assertConfigured();
  return createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, next: { tags: [PUBLIC_DATA_TAG] } }),
    },
  });
}
