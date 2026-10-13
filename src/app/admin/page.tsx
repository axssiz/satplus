import Link from "next/link";
import { AdminError, Empty, PageHeader, StatCard, TableWrap } from "./_components/ui";
import { adminPage, fmtDate, fmtMoney, one } from "./_components/data";

export const metadata = { title: "Обзор" };

type Stats = Record<string, number>;

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

export default async function AdminDashboard() {
  const { db } = await adminPage();
  const since = daysAgo(7);

  const [statsRes, reqRes, branchReqRes, staleRes, viewsRes, pricesRes] = await Promise.all([
    db.rpc("qaiarzan_dashboard_stats"),
    db.from("price_request_stats").select("product_id, open_requests, total_requests, last_requested_at").order("open_requests", { ascending: false }).limit(10),
    db.from("price_request_branch_stats").select("branch_id, total_requests").order("total_requests", { ascending: false }).limit(8),
    db.from("current_prices").select("id, product_id, store_name, branch_name, price, observed_at").eq("effective_status", "stale").eq("is_demo", false).order("observed_at").limit(10),
    db.from("product_views_daily").select("product_id, views").gte("day", since).limit(5000),
    db.from("verified_prices").select("branch_id").eq("is_demo", false).limit(20000),
  ]);

  if (statsRes.error) return <AdminError message={statsRes.error.message} />;
  const s = statsRes.data as Stats;

  const viewTotals = new Map<string, number>();
  for (const v of viewsRes.data ?? []) viewTotals.set(String(v.product_id), (viewTotals.get(String(v.product_id)) ?? 0) + Number(v.views));
  const topViewed = [...viewTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const pricesPerBranch = new Map<string, number>();
  for (const p of pricesRes.data ?? []) pricesPerBranch.set(String(p.branch_id), (pricesPerBranch.get(String(p.branch_id)) ?? 0) + 1);

  const productIds = [...new Set([...(reqRes.data ?? []).map((r) => String(r.product_id)), ...(staleRes.data ?? []).map((r) => String(r.product_id)), ...topViewed.map(([id]) => id)])];
  const branchIds = [...new Set([...(branchReqRes.data ?? []).map((r) => String(r.branch_id)), ...pricesPerBranch.keys()])];
  const [{ data: products }, { data: branches }] = await Promise.all([
    productIds.length ? db.from("products").select("id, name_ru, slug").in("id", productIds) : Promise.resolve({ data: [] }),
    branchIds.length ? db.from("store_branches").select("id, name, stores(name, is_demo)").in("id", branchIds) : Promise.resolve({ data: [] }),
  ]);
  const pName = new Map((products ?? []).map((p) => [String(p.id), { name: String(p.name_ru), slug: String(p.slug) }]));
  const bName = new Map(
    (branches ?? []).map((b) => {
      const st = one<{ name: string; is_demo: boolean }>(b.stores);
      return [String(b.id), { name: `${st?.name ?? ""} · ${b.name}`, demo: !!st?.is_demo }];
    }),
  );
  const topBranches = [...pricesPerBranch.entries()].filter(([id]) => !bName.get(id)?.demo).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <>
      <PageHeader title="Обзор QaiArzan" description="Сводка по ценам, модерации и спросу. Демо-данные в расчёт не входят." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ждут проверки" value={s.pending_submissions} hint={`из них подозрительных: ${s.flagged_submissions}`} tone={s.pending_submissions ? "warning" : undefined} />
        <StatCard label="Открытые жалобы" value={s.open_reports} tone={s.open_reports ? "danger" : undefined} />
        <StatCard label="Подтверждённых свежих цен" value={s.prices_fresh_verified} hint={`моложе ${s.stale_days} дн.`} />
        <StatCard label="Всего цен" value={s.prices_total} hint={`ориентировочных: ${s.prices_estimated}`} />
        <StatCard label="Активных товаров" value={s.products_active} />
        <StatCard label="Активных филиалов" value={s.branches_active} />
        <StatCard label="Заявок за 7 дней" value={s.submissions_7d} hint={`обновлений цен: ${s.price_updates_7d}`} />
        <StatCard label="Просмотров за 7 дней" value={s.views_7d} hint={`пользователей: ${s.users_total}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Чаще всего просят узнать цену</h2>
          {(reqRes.data ?? []).length === 0 ? (
            <Empty>Запросов пока нет.</Empty>
          ) : (
            <TableWrap>
              <thead><tr><th>Товар</th><th>Открытых</th><th>Всего</th><th>Последний</th></tr></thead>
              <tbody>
                {(reqRes.data ?? []).map((r) => (
                  <tr key={String(r.product_id)}>
                    <td><Link className="hover:underline" href={`/admin/prices?product=${r.product_id}`}>{pName.get(String(r.product_id))?.name ?? "—"}</Link></td>
                    <td className="font-semibold tabular-nums">{r.open_requests}</td>
                    <td className="tabular-nums">{r.total_requests}</td>
                    <td>{fmtDate(r.last_requested_at as string)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Устаревшие цены (самые старые)</h2>
          {(staleRes.data ?? []).length === 0 ? (
            <Empty>Устаревших цен нет.</Empty>
          ) : (
            <TableWrap>
              <thead><tr><th>Товар</th><th>Магазин</th><th>Цена</th><th>Дата</th></tr></thead>
              <tbody>
                {(staleRes.data ?? []).map((r) => (
                  <tr key={String(r.id)}>
                    <td>{pName.get(String(r.product_id))?.name ?? "—"}</td>
                    <td>{r.store_name} · {r.branch_name}</td>
                    <td className="tabular-nums">{fmtMoney(r.price as number)}</td>
                    <td>{fmtDate(r.observed_at as string, false)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Популярные товары за 7 дней</h2>
          {topViewed.length === 0 ? (
            <Empty>Просмотров пока нет.</Empty>
          ) : (
            <TableWrap>
              <thead><tr><th>Товар</th><th>Просмотры</th></tr></thead>
              <tbody>
                {topViewed.map(([id, views]) => (
                  <tr key={id}><td>{pName.get(id)?.name ?? "—"}</td><td className="tabular-nums">{views}</td></tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Филиалы: цены и запросы</h2>
          {topBranches.length === 0 && (branchReqRes.data ?? []).length === 0 ? (
            <Empty>Данных пока нет.</Empty>
          ) : (
            <TableWrap>
              <thead><tr><th>Филиал</th><th>Цен на сайте</th><th>Запросов цен</th></tr></thead>
              <tbody>
                {[...new Set([...topBranches.map(([id]) => id), ...(branchReqRes.data ?? []).map((r) => String(r.branch_id))])].map((id) => (
                  <tr key={id}>
                    <td>{bName.get(id)?.name ?? "—"}</td>
                    <td className="tabular-nums">{pricesPerBranch.get(id) ?? 0}</td>
                    <td className="tabular-nums">{(branchReqRes.data ?? []).find((r) => String(r.branch_id) === id)?.total_requests ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>
      </div>
    </>
  );
}
