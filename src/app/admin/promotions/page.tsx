import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { isFeatureEnabled } from "@/config/features";
import { cityToday, promotionState } from "@/lib/promotions/dates";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, one } from "../_components/data";
import { PROMOTION_STATUS, PromotionsFlagNotice } from "./shared";

export const metadata = { title: "Акции" };

const PERIOD = { active: "Действует", upcoming: "Ещё не началась", ended: "Завершилась" } as const;

export default async function AdminPromotionsPage({ searchParams }: PageProps<"/admin/promotions">) {
  const { db } = await adminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = typeof sp.status === "string" && sp.status in PROMOTION_STATUS ? sp.status : "";
  const today = cityToday();

  let query = db
    .from("promotions")
    .select("id, slug, title, status, starts_on, ends_on, discount_label, is_sponsored, source_name, stores(name, is_demo)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
  if (status) query = query.eq("status", status);

  const [{ data, error }, { count: pending }] = await Promise.all([
    query,
    db.from("promotion_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (error) return <AdminError message={error.message} />;

  return (
    <>
      <PageHeader
        title="Акции и скидки"
        description="Акции магазинов со сроками. Завершённые акции уходят из публичного списка сами по дате окончания. Акции не меняют цены в QaiArzan."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/promotions/reports">
                <Inbox aria-hidden /> Сообщения{pending ? ` (${pending})` : ""}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/promotions/new">
                <Plus aria-hidden /> Новая акция
              </Link>
            </Button>
          </>
        }
      />
      <PromotionsFlagNotice enabled={isFeatureEnabled("promotions")} />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <Input name="q" defaultValue={q} placeholder="Название, описание или магазин" aria-label="Поиск" />
        <NativeSelect name="status" defaultValue={status} aria-label="Статус">
          <option value="">Все статусы</option>
          {Object.entries(PROMOTION_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>
      {(data ?? []).length === 0 ? (
        <Empty>{q || status ? "Ничего не найдено." : "Акций пока нет. Создайте первую или опубликуйте сообщение покупателя."}</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Акция</th>
              <th>Магазин</th>
              <th>Статус</th>
              <th>Срок</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => {
              const st = PROMOTION_STATUS[String(p.status) as keyof typeof PROMOTION_STATUS];
              const period = promotionState(p.starts_on as string | null, String(p.ends_on), today);
              const store = one<{ name: string; is_demo: boolean }>(p.stores);
              return (
                <tr key={String(p.id)}>
                  <td className="max-w-md">
                    <Link href={`/admin/promotions/${p.id}`} className="font-medium hover:underline">
                      {String(p.title)}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.discount_label && <Badge tone="danger">{String(p.discount_label)}</Badge>}
                      {p.is_sponsored && <Badge tone="warning">Реклама</Badge>}
                    </div>
                  </td>
                  <td>
                    {store?.name ?? "—"} {store?.is_demo && <Badge tone="demo">DEMO</Badge>}
                  </td>
                  <td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap">
                    {p.starts_on ? `${p.starts_on} — ` : "по "}
                    {String(p.ends_on)}
                    <div className={period === "ended" ? "text-xs text-muted-foreground" : "text-xs text-primary-strong dark:text-primary"}>{PERIOD[period]}</div>
                  </td>
                  <td className="max-w-[12rem] truncate">{String(p.source_name)}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
