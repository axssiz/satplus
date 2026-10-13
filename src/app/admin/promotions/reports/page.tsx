import Link from "next/link";
import { CalendarClock, ExternalLink, ImageIcon, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminError, Empty, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate, one } from "../../_components/data";
import { RejectReport } from "./reject-report";

export const metadata = { title: "Сообщения об акциях" };

export default async function PromotionReportsPage() {
  const { db } = await adminPage();
  const { data, error } = await db
    .from("promotion_submissions")
    .select("id, title, details, store_text, ends_on, source_url, contact, photo_path, user_id, created_at, stores(name)")
    .eq("status", "pending")
    .order("created_at")
    .limit(100);
  if (error) return <AdminError message={error.message} />;

  return (
    <>
      <PageHeader
        title="Сообщения об акциях"
        description="Покупатели сообщают об акциях в магазинах. На сайт попадает только то, что модератор проверил и оформил как акцию."
        actions={
          <Link href="/admin/promotions" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все акции
          </Link>
        }
      />
      {(data ?? []).length === 0 ? (
        <Empty>Новых сообщений нет.</Empty>
      ) : (
        <ul className="grid max-w-4xl grid-cols-1 gap-3">
          {(data ?? []).map((s) => (
            <li key={String(s.id)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{fmtDate(String(s.created_at))}</span>
                <span className="font-medium text-foreground">
                  {one<{ name: string }>(s.stores)?.name ?? `${String(s.store_text)} (нет в справочнике)`}
                </span>
                <span>{s.user_id ? "От зарегистрированного пользователя" : "Анонимно"}</span>
                {s.ends_on && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" aria-hidden /> до {String(s.ends_on)}
                  </span>
                )}
                {s.photo_path && (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="size-3.5" aria-hidden /> есть фото
                  </span>
                )}
              </div>
              <h2 className="font-semibold">{String(s.title)}</h2>
              {s.details && <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{String(s.details)}</p>}
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
                  <Link href={`/admin/promotions/new?from=${s.id}`}>
                    <PenLine aria-hidden /> Проверить и опубликовать
                  </Link>
                </Button>
                <RejectReport id={String(s.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
