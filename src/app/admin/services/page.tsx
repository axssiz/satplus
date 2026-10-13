import Link from "next/link";
import { ExternalLink, FolderTree, ImageIcon, MessageSquareWarning, PenLine, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isFeatureEnabled } from "@/config/features";
import { storagePublicUrl } from "@/lib/env";
import { cn } from "@/lib/utils";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, fmtDate, one } from "../_components/data";
import { ModerateListing } from "./moderate-listing";
import { SERVICE_STATUS, ServicesFlagNotice } from "./shared";

export const metadata = { title: "Услуги" };

type Status = keyof typeof SERVICE_STATUS;

export default async function AdminServicesPage({ searchParams }: PageProps<"/admin/services">) {
  const { db, user } = await adminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status: Status = typeof sp.status === "string" && sp.status in SERVICE_STATUS ? (sp.status as Status) : "pending";

  let query = db
    .from("service_listings")
    .select(
      "id, slug, title, provider_name, description, price_note, area, phone, has_whatsapp, link_url, cover_path, owner_id, source_name, status, reject_reason, expires_on, is_sponsored, created_at, service_categories(name_ru)",
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(200);
  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`);

  const [{ data, error }, counts, { count: complaints }] = await Promise.all([
    query,
    Promise.all(
      (Object.keys(SERVICE_STATUS) as Status[]).map(async (s) => {
        const { count } = await db.from("service_listings").select("id", { count: "exact", head: true }).eq("status", s);
        return [s, count ?? 0] as const;
      }),
    ),
    db.from("listing_complaints").select("id", { count: "exact", head: true }).eq("status", "open").eq("target_type", "service_listing"),
  ]);
  if (error) return <AdminError message={error.message} />;
  const countOf = Object.fromEntries(counts) as Record<Status, number>;

  return (
    <>
      <PageHeader
        title="Услуги и мастера"
        description="Объявления мастеров. На сайт попадает только то, что одобрил модератор; срок показа 90 дней, мастер может продлить."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/complaints?type=service_listing">
                <MessageSquareWarning aria-hidden /> Жалобы{complaints ? ` (${complaints})` : ""}
              </Link>
            </Button>
            {user.isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/services/categories">
                  <FolderTree aria-hidden /> Категории
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/admin/services/new">
                <Plus aria-hidden /> Добавить из источника
              </Link>
            </Button>
          </>
        }
      />
      <ServicesFlagNotice enabled={isFeatureEnabled("services")} />

      <nav aria-label="Статус" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(SERVICE_STATUS) as Status[]).map((s) => (
          <Link
            key={s}
            href={`/admin/services?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
              s === status ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {SERVICE_STATUS[s].label} <span className="tabular opacity-70">{countOf[s]}</span>
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex gap-2">
        <input type="hidden" name="status" value={status} />
        <Input name="q" defaultValue={q} placeholder="Услуга, мастер, описание" aria-label="Поиск" />
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>

      {(data ?? []).length === 0 ? (
        <Empty>{status === "pending" ? "Новых объявлений на проверке нет." : "Ничего не найдено."}</Empty>
      ) : status === "pending" ? (
        <ul className="grid max-w-4xl grid-cols-1 gap-3">
          {(data ?? []).map((s) => {
            const cover = storagePublicUrl("service-images", s.cover_path as string | null);
            return (
              <li key={String(s.id)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Badge tone="info">{one<{ name_ru: string }>(s.service_categories)?.name_ru ?? "Без категории"}</Badge>
                  <span>{fmtDate(String(s.created_at))}</span>
                  <span>{s.owner_id ? "От мастера (аккаунт)" : `Источник: ${String(s.source_name)}`}</span>
                  {s.cover_path && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="size-3.5" aria-hidden /> есть фото
                    </span>
                  )}
                </div>
                <h2 className="font-semibold">{String(s.title)}</h2>
                <p className="text-sm">
                  {String(s.provider_name)} · <a href={`tel:${String(s.phone).replace(/[^+0-9]/g, "")}`} className="font-medium">{String(s.phone)}</a>
                  {s.has_whatsapp && " · WhatsApp"}
                </p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{String(s.description)}</p>
                <dl className="grid gap-1 text-sm sm:grid-cols-2">
                  {s.price_note && <div><dt className="inline text-muted-foreground">Цена: </dt><dd className="inline">{String(s.price_note)}</dd></div>}
                  {s.area && <div><dt className="inline text-muted-foreground">Где: </dt><dd className="inline">{String(s.area)}</dd></div>}
                </dl>
                {s.link_url && (
                  <a href={String(s.link_url)} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-sm text-primary-strong hover:underline dark:text-primary">
                    {String(s.link_url)} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin preview
                  <img src={cover} alt="Фото из объявления" className="max-h-60 rounded-xl border border-border" />
                )}
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <ModerateListing id={String(s.id)} />
                  <Link href={`/admin/services/${s.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <PenLine className="size-3.5" aria-hidden /> Исправить перед публикацией
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Объявление</th>
              <th>Категория</th>
              <th>Мастер</th>
              <th>{status === "rejected" ? "Причина" : "Активно до"}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={String(s.id)}>
                <td className="max-w-sm">
                  <Link href={`/admin/services/${s.id}`} className="font-medium hover:underline">
                    {String(s.title)}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.is_sponsored && <Badge tone="warning">Реклама</Badge>}
                    {!s.owner_id && <Badge tone="outline">из источника</Badge>}
                  </div>
                </td>
                <td>{one<{ name_ru: string }>(s.service_categories)?.name_ru ?? "—"}</td>
                <td className="whitespace-nowrap">
                  {String(s.provider_name)}
                  <div className="text-xs text-muted-foreground">{String(s.phone)}</div>
                </td>
                <td className="max-w-[16rem]">{status === "rejected" ? String(s.reject_reason ?? "—") : String(s.expires_on ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
