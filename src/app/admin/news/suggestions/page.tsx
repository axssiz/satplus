import Link from "next/link";
import { ExternalLink, ImageIcon, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminError, Empty, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate, one } from "../../_components/data";
import { RejectSuggestion } from "./reject-suggestion";

export const metadata = { title: "Предложения новостей" };

export default async function NewsSuggestionsPage() {
  const { db } = await adminPage();
  const { data, error } = await db
    .from("news_submissions")
    .select("id, title, body, source_url, contact, photo_path, user_id, created_at, news_categories(name_ru)")
    .eq("status", "pending")
    .order("created_at")
    .limit(100);
  if (error) return <AdminError message={error.message} />;

  return (
    <>
      <PageHeader
        title="Предложения новостей"
        description="Сообщения читателей. На сайт попадает только то, что редакция проверила и оформила как новость."
        actions={
          <Link href="/admin/news" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все новости
          </Link>
        }
      />
      {(data ?? []).length === 0 ? (
        <Empty>Новых предложений нет.</Empty>
      ) : (
        <ul className="grid max-w-4xl grid-cols-1 gap-3">
          {(data ?? []).map((s) => (
            <li key={String(s.id)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{fmtDate(String(s.created_at))}</span>
                <span>{one<{ name_ru: string }>(s.news_categories)?.name_ru ?? "Без категории"}</span>
                <span>{s.user_id ? "От зарегистрированного пользователя" : "Анонимно"}</span>
                {s.photo_path && (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="size-3.5" aria-hidden /> есть фото
                  </span>
                )}
              </div>
              <h2 className="font-semibold">{String(s.title)}</h2>
              <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{String(s.body)}</p>
              {s.source_url && (
                <a
                  href={String(s.source_url)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex max-w-full items-center gap-1 truncate text-sm text-primary-strong hover:underline dark:text-primary"
                >
                  {String(s.source_url)} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              )}
              {s.contact && <p className="text-sm">Контакт: {String(s.contact)}</p>}
              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <Button asChild size="sm">
                  <Link href={`/admin/news/new?from=${s.id}`}>
                    <PenLine aria-hidden /> Проверить и опубликовать
                  </Link>
                </Button>
                <RejectSuggestion id={String(s.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
