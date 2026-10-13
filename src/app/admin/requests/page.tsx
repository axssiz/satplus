import Link from "next/link";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, fmtDate, one } from "../_components/data";

export const metadata = { title: "Запросы цен" };

export default async function RequestsPage() {
  const { db } = await adminPage();
  const [{ data: stats, error }, { data: branchStats }] = await Promise.all([
    db.from("price_request_stats").select("product_id, open_requests, total_requests, last_requested_at").order("open_requests", { ascending: false }).order("total_requests", { ascending: false }).limit(200),
    db.from("price_request_branch_stats").select("branch_id, total_requests, last_requested_at").order("total_requests", { ascending: false }).limit(50),
  ]);
  if (error) return <AdminError message={error.message} />;
  const pIds = (stats ?? []).map((s) => String(s.product_id));
  const bIds = (branchStats ?? []).map((s) => String(s.branch_id));
  const [{ data: products }, { data: branches }, { data: priced }] = await Promise.all([
    pIds.length ? db.from("products").select("id, name_ru").in("id", pIds) : Promise.resolve({ data: [] }),
    bIds.length ? db.from("store_branches").select("id, name, stores(name)").in("id", bIds) : Promise.resolve({ data: [] }),
    pIds.length ? db.from("verified_prices").select("product_id").eq("is_demo", false).in("product_id", pIds) : Promise.resolve({ data: [] }),
  ]);
  const pName = new Map((products ?? []).map((p) => [String(p.id), String(p.name_ru)]));
  const priceCount = new Map<string, number>();
  for (const p of priced ?? []) priceCount.set(String(p.product_id), (priceCount.get(String(p.product_id)) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Запросы цен"
        description="Пользователи нажимают «Хочу узнать цену», когда цены нет или она устарела. «Открытые» — запросы после последнего обновления цены. Это подсказка, какие цены проверить в первую очередь."
      />
      {(stats ?? []).length === 0 ? (
        <Empty>Запросов пока нет.</Empty>
      ) : (
        <TableWrap>
          <thead><tr><th>Товар</th><th>Открытых</th><th>Всего</th><th>Цен на сайте</th><th>Последний запрос</th><th></th></tr></thead>
          <tbody>
            {(stats ?? []).map((s) => (
              <tr key={String(s.product_id)}>
                <td>{pName.get(String(s.product_id)) ?? "—"}</td>
                <td className="font-semibold tabular-nums">{s.open_requests}</td>
                <td className="tabular-nums">{s.total_requests}</td>
                <td className="tabular-nums">{priceCount.get(String(s.product_id)) ?? 0}</td>
                <td>{fmtDate(s.last_requested_at as string)}</td>
                <td><Link href={`/admin/prices?product=${s.product_id}`} className="text-primary-strong hover:underline dark:text-primary">Внести цены</Link></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <h2 className="mb-2 mt-8 font-semibold">По филиалам</h2>
      {(branchStats ?? []).length === 0 ? (
        <Empty>Запросов с указанием филиала пока нет.</Empty>
      ) : (
        <TableWrap>
          <thead><tr><th>Филиал</th><th>Запросов</th><th>Последний</th></tr></thead>
          <tbody>
            {(branchStats ?? []).map((s) => {
              const b = (branches ?? []).find((x) => String(x.id) === String(s.branch_id));
              return (
                <tr key={String(s.branch_id)}>
                  <td>{b ? `${one<{ name: string }>(b.stores)?.name ?? ""} · ${b.name}` : "—"}</td>
                  <td className="tabular-nums">{s.total_requests}</td>
                  <td>{fmtDate(s.last_requested_at as string)}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
