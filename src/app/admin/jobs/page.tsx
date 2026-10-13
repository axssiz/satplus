import Link from "next/link";
import { ExternalLink, FolderTree, MessageSquareWarning, PenLine, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isFeatureEnabled } from "@/config/features";
import { cn } from "@/lib/utils";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, fmtDate, one } from "../_components/data";
import { ModerateJob } from "./moderate-job";
import { EMPLOYMENT_LABEL, EXPERIENCE_LABEL, JOB_STATUS, JobsFlagNotice, salaryText } from "./shared";

export const metadata = { title: "Вакансии" };

type Status = keyof typeof JOB_STATUS;

export default async function AdminJobsPage({ searchParams }: PageProps<"/admin/jobs">) {
  const { db, user } = await adminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status: Status = typeof sp.status === "string" && sp.status in JOB_STATUS ? (sp.status as Status) : "pending";

  let query = db
    .from("job_listings")
    .select(
      "id, slug, title, employer_name, employment_type, experience, schedule, salary_from, salary_to, salary_note, description, address, contact_name, phone, has_whatsapp, email, link_url, owner_id, source_name, status, reject_reason, expires_on, is_sponsored, created_at, job_categories(name_ru)",
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(200);
  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`);

  const [{ data, error }, counts, { count: complaints }] = await Promise.all([
    query,
    Promise.all(
      (Object.keys(JOB_STATUS) as Status[]).map(async (s) => {
        const { count } = await db.from("job_listings").select("id", { count: "exact", head: true }).eq("status", s);
        return [s, count ?? 0] as const;
      }),
    ),
    db.from("listing_complaints").select("id", { count: "exact", head: true }).eq("status", "open").eq("target_type", "job_listing"),
  ]);
  if (error) return <AdminError message={error.message} />;
  const countOf = Object.fromEntries(counts) as Record<Status, number>;

  return (
    <>
      <PageHeader
        title="Работа и вакансии"
        description="Вакансии работодателей. На сайт попадает только то, что одобрил модератор; срок показа 30 дней, работодатель может продлить."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/complaints?type=job_listing">
                <MessageSquareWarning aria-hidden /> Жалобы{complaints ? ` (${complaints})` : ""}
              </Link>
            </Button>
            {user.isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/jobs/categories">
                  <FolderTree aria-hidden /> Сферы
                </Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/admin/jobs/new">
                <Plus aria-hidden /> Добавить из источника
              </Link>
            </Button>
          </>
        }
      />
      <JobsFlagNotice enabled={isFeatureEnabled("jobs")} />

      <nav aria-label="Статус" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(JOB_STATUS) as Status[]).map((s) => (
          <Link
            key={s}
            href={`/admin/jobs?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
              s === status ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {JOB_STATUS[s].label} <span className="tabular opacity-70">{countOf[s]}</span>
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex gap-2">
        <input type="hidden" name="status" value={status} />
        <Input name="q" defaultValue={q} placeholder="Должность, работодатель, описание" aria-label="Поиск" />
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>

      {(data ?? []).length === 0 ? (
        <Empty>{status === "pending" ? "Новых вакансий на проверке нет." : "Ничего не найдено."}</Empty>
      ) : status === "pending" ? (
        <ul className="grid max-w-4xl grid-cols-1 gap-3">
          {(data ?? []).map((j) => (
            <li key={String(j.id)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <Badge tone="info">{one<{ name_ru: string }>(j.job_categories)?.name_ru ?? "Без сферы"}</Badge>
                <span>{fmtDate(String(j.created_at))}</span>
                <span>{j.owner_id ? "От работодателя (аккаунт)" : `Источник: ${String(j.source_name)}`}</span>
              </div>
              <h2 className="font-semibold">{String(j.title)}</h2>
              <p className="text-sm">
                {String(j.employer_name)} · <a href={`tel:${String(j.phone).replace(/[^+0-9]/g, "")}`} className="font-medium">{String(j.phone)}</a>
                {j.has_whatsapp && " · WhatsApp"}
                {j.email && ` · ${String(j.email)}`}
              </p>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted-foreground">Зарплата: </dt><dd className="inline">{salaryText(j.salary_from, j.salary_to)}{j.salary_note ? ` (${String(j.salary_note)})` : ""}</dd></div>
                <div><dt className="inline text-muted-foreground">Занятость: </dt><dd className="inline">{EMPLOYMENT_LABEL[String(j.employment_type)]}</dd></div>
                <div><dt className="inline text-muted-foreground">Опыт: </dt><dd className="inline">{EXPERIENCE_LABEL[String(j.experience)]}</dd></div>
                {j.schedule && <div><dt className="inline text-muted-foreground">График: </dt><dd className="inline">{String(j.schedule)}</dd></div>}
                {j.address && <div><dt className="inline text-muted-foreground">Место: </dt><dd className="inline">{String(j.address)}</dd></div>}
                {j.contact_name && <div><dt className="inline text-muted-foreground">Контакт: </dt><dd className="inline">{String(j.contact_name)}</dd></div>}
              </dl>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{String(j.description)}</p>
              {j.link_url && (
                <a href={String(j.link_url)} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-sm text-primary-strong hover:underline dark:text-primary">
                  {String(j.link_url)} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <ModerateJob id={String(j.id)} />
                <Link href={`/admin/jobs/${j.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <PenLine className="size-3.5" aria-hidden /> Исправить перед публикацией
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Вакансия</th>
              <th>Сфера</th>
              <th>Работодатель</th>
              <th>Зарплата</th>
              <th>{status === "rejected" ? "Причина" : "Активна до"}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((j) => (
              <tr key={String(j.id)}>
                <td className="max-w-sm">
                  <Link href={`/admin/jobs/${j.id}`} className="font-medium hover:underline">
                    {String(j.title)}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {j.is_sponsored && <Badge tone="warning">Реклама</Badge>}
                    {!j.owner_id && <Badge tone="outline">из источника</Badge>}
                  </div>
                </td>
                <td>{one<{ name_ru: string }>(j.job_categories)?.name_ru ?? "—"}</td>
                <td className="whitespace-nowrap">
                  {String(j.employer_name)}
                  <div className="text-xs text-muted-foreground">{String(j.phone)}</div>
                </td>
                <td className="whitespace-nowrap">{salaryText(j.salary_from, j.salary_to)}</td>
                <td className="max-w-[16rem]">{status === "rejected" ? String(j.reject_reason ?? "—") : String(j.expires_on ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
