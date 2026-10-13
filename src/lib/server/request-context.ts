import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Salted hash of the client's IP + user agent. Used only for rate limiting and
 * one-vote-per-device; the raw IP is never stored.
 */
export async function clientHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  const ua = h.get("user-agent") ?? "";
  const salt = process.env.CLIENT_HASH_SALT;
  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("CLIENT_HASH_SALT must be set in production");
  }
  return createHash("sha256").update(`${salt ?? "dev-salt"}|${ip}|${ua}`).digest("hex");
}
