import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, fmtDate, fmtMoney, loadBranches, one, unitRu } from "../_components/data";
import { BranchPicker, PriceGrid, type GridRow } from "./price-grid";

export const metadata = { title: "Цены" };

const SOURCE: Record<string, string> = {
  user_submission: "Пользователь",
  admin_check: "Проверка админом",
  store_website: "Сайт магазина",
  price_tag_photo: "Фото ценника",
  receipt: "Чек",
  import: "Импорт",
  demo: "DEMO",
};

export default async function PricesPage({ searchParams }: PageProps<"/admin/prices">) {
  const { db } = await adminPage();
  const sp = await searchParams;
  const branchId = typeof sp.branch === "string" ? sp.branch : "";
  const productId = typeof sp.product === "string" ? sp.product : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let branches;
  try {
    branches = await loadBranches(db);
  } catch (e) {
    return <AdminError message={(e as Error).message} />;
  }
  const realBranches = branches.filter((b) => !b.is_demo);

  let rows: GridRow[] = [];
  let gridTitle = "";
  if (branchId || productId) {
    let productsQuery = db.from("products").select("id, slug, name_ru, unit, net_quantity, net_unit, comparison_mode, is_weighted").eq("is_active", true).order("name_ru");
    if (productId) productsQuery = productsQuery.eq("id", productId);
    if (q) productsQuery = productsQuery.ilike("search_text", `%${q.toLowerCase()}%`);
    const { data: products, error } = await productsQuery.limit(500);
    if (error) return <AdminError message={error.message} />;
    const targetBranches = productId ? realBranches : realBranches.filter((b) => b.id === branchId);
    const ids = (products ?? []).map((p) => String(p.id));
    let pricesQuery = db.from("verified_prices").select("id, product_id, branch_id, price, status, observed_at, source_type, pack_quantity, pack_unit");
    pricesQuery = productId ? pricesQuery.eq("product_id", productId) : pricesQuery.eq("branch_id", branchId).in("product_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const { data: prices, error: pErr } = await pricesQuery;
    if (pErr) return <AdminError message={pErr.message} />;
    const priceMap = new Map((prices ?? []).map((p) => [`${p.product_id}|${p.branch_id}`, p]));
    for (const p of products ?? []) {
      for (const b of targetBranches) {
        const cur = priceMap.get(`${p.id}|${b.id}`);
        rows.push({
          key: `${p.id}|${b.id}`,
          productId: String(p.id),
          branchId: b.id,
          productName: String(p.name_ru),
          productSlug: String(p.slug),
          branchName: `${b.store_name} · ${b.name}`,
          pack: p.net_quantity ? `${Number(p.net_quantity)} ${unitRu(p.net_unit)}` : p.is_weighted ? `за 1 ${unitRu(p.unit)}` : null,
          analog: p.comparison_mode === "analog",
          current: cur
            ? {
                id: String(cur.id),
                price: Number(cur.price),
                status: String(cur.status),
                observedAt: String(cur.observed_at),
                source: SOURCE[String(cur.source_type)] ?? String(cur.source_type),
              }
            : null,
        });
      }
    }
    gridTitle = productId ? `Товар по всем филиалам: ${products?.[0]?.name_ru ?? ""}` : (realBranches.find((b) => b.id === branchId)?.name ?? "");
    if (productId && !products?.length) rows = [];
  }

  const { data: history } = await db
    .from("price_history")
    .select("id, product_id, branch_id, price, status, source_type, observed_at, recorded_at, products(name_ru), store_branches(name, stores(name))")
    .eq("is_demo", false)
    .order("recorded_at", { ascending: false })
    .limit(25);

  return (
    <>
      <PageHeader
        title="Цены"
        description="Быстрый ввод проверенных цен по филиалу. Пустая ячейка означает «цена неизвестна» — ничего не заполняйте наугад. DEMO-филиалы здесь не редактируются."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/prices/import"><Upload aria-hidden /> Импорт CSV</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/admin/prices/export" download><Download aria-hidden /> Экспорт CSV</a>
            </Button>
          </>
        }
      />

      <BranchPicker branches={realBranches} branchId={branchId} q={q} />

      {branchId || productId ? (
        rows.length === 0 ? (
          <Empty>Нет товаров для отображения.</Empty>
        ) : (
          <PriceGrid key={`${branchId}|${productId}|${q}`} rows={rows} title={gridTitle} perProduct={!!productId} />
        )
      ) : (
        <Empty>Выберите филиал, чтобы ввести или обновить цены.</Empty>
      )}

      <section className="mt-8">
        <h2 className="mb-2 font-semibold">Последние изменения цен</h2>
        {(history ?? []).length === 0 ? (
          <Empty>Истории пока нет.</Empty>
        ) : (
          <TableWrap>
            <thead><tr><th>Когда записано</th><th>Товар</th><th>Филиал</th><th>Цена</th><th>Статус</th><th>Источник</th><th>Дата наблюдения</th></tr></thead>
            <tbody>
              {(history ?? []).map((h) => {
                const br = one<{ name: string; stores: unknown }>(h.store_branches);
                return (
                  <tr key={String(h.id)}>
                    <td>{fmtDate(h.recorded_at as string)}</td>
                    <td>{one<{ name_ru: string }>(h.products)?.name_ru ?? "—"}</td>
                    <td>{one<{ name: string }>(br?.stores)?.name} · {br?.name}</td>
                    <td className="tabular-nums">{fmtMoney(h.price as number)}</td>
                    <td>{h.status === "verified" ? "Подтверждена" : "Ориентировочная"}</td>
                    <td>{SOURCE[String(h.source_type)] ?? String(h.source_type)}</td>
                    <td>{fmtDate(h.observed_at as string, false)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </section>
    </>
  );
}
