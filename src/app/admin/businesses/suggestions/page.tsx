import Link from "next/link";
import { ExternalLink, ImageIcon, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminError, Empty, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate, one } from "../../_components/data";
import { RejectBusinessSuggestion } from "./reject-suggestion";

export const metadata = { title: "Сообщения об организациях" };

export default async function BusinessSuggestionsPage() {
  const { db } = await adminPage();
  const { data, error } = await db
    .from("business_submissions")
    .select(
      "id, kind, business_id, name, address, phone, website, opening_hours, details, is_owner, contact, photo_path, user_id, created_at, business_categories(name_ru), businesses!business_submissions_business_id_fkey(name, slug)",
    )
    .eq("status", "pending")
    .order("created_at")
    .limit(100);
  if (error) return <AdminError message={error.message} />;

  return (
    <>
      <PageHeader
        title="Сообщения об организациях"
        description="Новые организации и исправления от читателей. В справочник попадает только то, что модератор проверил."
        actions={
          <Link href="/admin/businesses" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все организации
          </Link>
        }
      />
      {(data ?? []).length === 0 ? (
        <Empty>Новых сообщений нет.</Empty>
      ) : (
        <ul className="grid max-w-4xl grid-cols-1 gap-3">
          {(data ?? []).map((s) => {
            const target = one<{ name: string; slug: string }>(s.businesses);
            const isCorrection = s.kind === "correction";
            return (
              <li key={String(s.id)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Badge tone={isCorrection ? "info" : "primary"}>{isCorrection ? "Исправление" : "Новая организация"}</Badge>
                  <span>{fmtDate(String(s.created_at))}</span>
                  {!isCorrection && <span>{one<{ name_ru: string }>(s.business_categories)?.name_ru ?? "Без категории"}</span>}
                  <span>{s.user_id ? "От зарегистрированного пользователя" : "Анонимно"}</span>
                  {s.is_owner && <Badge tone="warning">Представитель организации</Badge>}
                  {s.photo_path && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="size-3.5" aria-hidden /> есть фото
                    </span>
                  )}
                </div>
                <h2 className="font-semibold">{isCorrection ? `Исправление: ${target?.name ?? "организация удалена"}` : String(s.name)}</h2>
                <dl className="grid gap-1 text-sm sm:grid-cols-2">
                  {s.address && <div><dt className="inline text-muted-foreground">Адрес: </dt><dd className="inline">{String(s.address)}</dd></div>}
                  {s.phone && <div><dt className="inline text-muted-foreground">Телефон: </dt><dd className="inline">{String(s.phone)}</dd></div>}
                  {s.opening_hours && <div><dt className="inline text-muted-foreground">График: </dt><dd className="inline">{String(s.opening_hours)}</dd></div>}
                  {s.website && (
                    <div className="truncate">
                      <dt className="inline text-muted-foreground">Сайт: </dt>
                      <dd className="inline">
                        <a href={String(s.website)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary-strong hover:underline dark:text-primary">
                          {String(s.website)} <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
                {s.details && <p className="whitespace-pre-line text-sm text-muted-foreground">{String(s.details)}</p>}
                {s.contact && <p className="text-sm">Контакт: {String(s.contact)}</p>}
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button asChild size="sm">
                    <Link href={isCorrection && s.business_id ? `/admin/businesses/${s.business_id}?from=${s.id}` : `/admin/businesses/new?from=${s.id}`}>
                      <PenLine aria-hidden /> {isCorrection ? "Проверить и исправить" : "Проверить и опубликовать"}
                    </Link>
                  </Button>
                  <RejectBusinessSuggestion id={String(s.id)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
