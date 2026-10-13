import Link from "next/link";
import { FolderTree, Inbox, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { isFeatureEnabled } from "@/config/features";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, one } from "../_components/data";
import { BUSINESS_STATUS, BusinessesFlagNotice } from "./shared";

export const metadata = { title: "Организации" };

export default async function AdminBusinessesPage({ searchParams }: PageProps<"/admin/businesses">) {
  const { db, user } = await adminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = typeof sp.status === "string" && sp.status in BUSINESS_STATUS ? sp.status : "";

  let query = db
    .from("businesses")
    .select("id, slug, name, status, address, phone, verification_status, last_verified_at, is_sponsored, latitude, business_categories(name_ru)")
    .order("name")
    .limit(300);
  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
  if (status) query = query.eq("status", status);

  const [{ data, error }, { count: pending }] = await Promise.all([
    query,
    db.from("business_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (error) return <AdminError message={error.message} />;

  return (
    <>
      <PageHeader
        title="Заведения и организации"
        description="Справочник города. Публикуйте только проверенные данные; если факт не проверен, оставьте поле пустым."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/businesses/suggestions">
                <Inbox aria-hidden /> Сообщения{pending ? ` (${pending})` : ""}
              </Link>
            </Button>
            {user.isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/businesses/categories">
                  <FolderTree aria-hidden /> Категории
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/admin/businesses/new">
                <Plus aria-hidden /> Новая организация
              </Link>
            </Button>
          </>
        }
      />
      <BusinessesFlagNotice enabled={isFeatureEnabled("businesses")} />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <Input name="q" defaultValue={q} placeholder="Название, адрес или категория" aria-label="Поиск" />
        <NativeSelect name="status" defaultValue={status} aria-label="Статус">
          <option value="">Все статусы</option>
          {Object.entries(BUSINESS_STATUS).map(([k, v]) => (
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
        <Empty>{q || status ? "Ничего не найдено." : "Организаций пока нет. Создайте первую или опубликуйте сообщение читателя."}</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Название</th>
              <th>Категория</th>
              <th>Статус</th>
              <th>Данные</th>
              <th>Адрес</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((b) => {
              const st = BUSINESS_STATUS[String(b.status) as keyof typeof BUSINESS_STATUS];
              return (
                <tr key={String(b.id)}>
                  <td className="max-w-sm">
                    <Link href={`/admin/businesses/${b.id}`} className="font-medium hover:underline">
                      {String(b.name)}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {b.is_sponsored && <Badge tone="warning">Реклама</Badge>}
                      {b.latitude == null && <Badge tone="outline">без координат</Badge>}
                      {!b.phone && <Badge tone="outline">без телефона</Badge>}
                    </div>
                  </td>
                  <td>{one<{ name_ru: string }>(b.business_categories)?.name_ru ?? "—"}</td>
                  <td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap">
                    {b.verification_status === "verified" ? (
                      <Badge tone="primary">проверено {String(b.last_verified_at)}</Badge>
                    ) : (
                      <Badge tone="warning">требует проверки</Badge>
                    )}
                  </td>
                  <td className="max-w-[14rem] truncate">{(b.address as string | null) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
