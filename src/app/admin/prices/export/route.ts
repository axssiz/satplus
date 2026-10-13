import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Current non-demo prices in the same column layout the CSV import accepts. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isModerator) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("verified_prices")
    .select("price, status, observed_at, source_type, source_note, source_url, pack_quantity, pack_unit, brand_label, products(slug, name_ru), store_branches(slug, name, stores(name))")
    .eq("is_demo", false)
    .order("observed_at", { ascending: false })
    .limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = ["product", "branch", "price", "status", "observed_at", "source_type", "source_note", "source_url", "pack_quantity", "pack_unit", "brand_label", "product_name", "store_branch_name"];
  const lines = [header.join(",")];
  for (const r of data ?? []) {
    const p = (Array.isArray(r.products) ? r.products[0] : r.products) as { slug: string; name_ru: string } | null;
    const b = (Array.isArray(r.store_branches) ? r.store_branches[0] : r.store_branches) as { slug: string; name: string; stores: unknown } | null;
    const s = (Array.isArray(b?.stores) ? b?.stores[0] : b?.stores) as { name: string } | null;
    lines.push(
      [
        p?.slug,
        b?.slug,
        r.price,
        r.status,
        new Date(String(r.observed_at)).toISOString(),
        r.source_type === "user_submission" ? "import" : r.source_type,
        r.source_note,
        r.source_url,
        r.pack_quantity,
        r.pack_unit,
        r.brand_label,
        p?.name_ru,
        `${s?.name ?? ""} · ${b?.name ?? ""}`,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="qaiarzan-prices-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
