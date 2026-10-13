import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { IconArt } from "@/lib/icon-art";

const SIZES = new Set([192, 512]);

export async function GET(request: NextRequest, ctx: RouteContext<"/icons/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = request.nextUrl.searchParams.get("maskable") === "1";
  return new ImageResponse(<IconArt size={size} maskable={maskable} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=604800, immutable" },
  });
}
