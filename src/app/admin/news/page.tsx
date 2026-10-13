import Link from "next/link";
import { FolderTree, Inbox, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { isFeatureEnabled } from "@/config/features";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, fmtDate, one } from "../_components/data";
import { isFuture, NewsFlagNotice, NEWS_STATUS } from "./shared";

export const metadata = { title: "Новости" };

export default async function AdminNewsPage({ searchParams }: PageProps<"/admin/news">) {
  const { db, user } = await adminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = typeof sp.status === "string" && sp.status in NEWS_STATUS ? sp.status : "";

  let query = db
    .from("news")
    .select("id, slug, title, status, published_at, updated_at, source_name, is_important, is_sponsored, lang, news_categories(name_ru)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
  if (status) query = query.eq("status", status);

  const [{ data, error }, { count: pending }] = await Promise.all([
    query,
    db.from("news_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (error) return <AdminError message={error.message} />;

  return (
    <>
      <PageHeader
        title="Новости"
        description="Публикуются только материалы с указанным источником. Черновики и запланированные новости читатели не видят."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/news/suggestions">
                <Inbox aria-hidden /> Предложения{pending ? ` (${pending})` : ""}
              </Link>
            </Button>
            {user.isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/news/categories">
                  <FolderTree aria-hidden /> Категории
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/admin/news/new">
                <Plus aria-hidden /> Новая новость
              </Link>
            </Button>
          </>
        }
      />
      <NewsFlagNotice enabled={isFeatureEnabled("news")} />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <Input name="q" defaultValue={q} placeholder="Заголовок, анонс или источник" aria-label="Поиск" />
        <NativeSelect name="status" defaultValue={status} aria-label="Статус">
          <option value="">Все статусы</option>
          {Object.entries(NEWS_STATUS).map(([k, v]) => (
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
        <Empty>{q || status ? "Ничего не найдено." : "Новостей пока нет. Создайте первую или опубликуйте предложение читателя."}</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Заголовок</th>
              <th>Категория</th>
              <th>Статус</th>
              <th>Публикация</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((n) => {
              const st = NEWS_STATUS[String(n.status) as keyof typeof NEWS_STATUS];
              const scheduled = n.status === "published" && isFuture(n.published_at as string | null);
              return (
                <tr key={String(n.id)}>
                  <td className="max-w-md">
                    <Link href={`/admin/news/${n.id}`} className="font-medium hover:underline">
                      {String(n.title)}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {n.is_important && <Badge tone="danger">Важно</Badge>}
                      {n.is_sponsored && <Badge tone="warning">Партнёрский</Badge>}
                      {n.lang === "kk" && <Badge tone="info">KZ</Badge>}
                    </div>
                  </td>
                  <td>{one<{ name_ru: string }>(n.news_categories)?.name_ru ?? "—"}</td>
                  <td>
                    <Badge tone={scheduled ? "info" : st.tone}>{scheduled ? "Запланирована" : st.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap">{fmtDate(n.published_at as string | null)}</td>
                  <td className="max-w-[12rem] truncate">{String(n.source_name)}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
