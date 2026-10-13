import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ConfigurationError, publicEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use ONLY in server code after validating input
 * and checking permissions. Never import from client components.
 */
export function createSupabaseServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) {
    throw new ConfigurationError("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
