import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AdminError, Empty, PageHeader } from "../_components/ui";
import { adminPage, fmtDate } from "../_components/data";
import { JOB_STATUS } from "../jobs/shared";
import { SERVICE_STATUS } from "../services/shared";
import { ComplaintActions } from "./complaint-actions";

export const metadata = { title: "Жалобы на объявления" };

const COMPLAINT_REASON: Record<string, string> = {
  fraud: "Мошенничество или просят деньги",
  spam: "Спам или чужая реклама",
  wrong_contacts: "Неверные контакты",
  not_actual: "Неактуально",
  offensive: "Оскорбления или дискриминация",
  other: "Другое",
};

const TYPES = {
  all: "Все",
  service_listing: "Услуги",
  job_listing: "Вакансии",
} as const;
type TypeFilter = keyof typeof TYPES;

type Target = { id: string; title: string; who: string; phone: string; status: string; href: string; statusLabel?: { label: string; tone: "info" | "primary" | "danger" | "outline" } };

export default async function ListingComplaintsPage({ searchParams }: PageProps<"/admin/complaints">) {
  const { db } = await adminPage();
  const sp = await searchParams;
  const type: TypeFilter = typeof sp.type === "string" && sp.type in TYPES ? (sp.type as TypeFilter) : "all";

  let query = db
    .from("listing_complaints")
    .select("id, target_type, target_id, reason, message, reporter_id, created_at")
    .eq("status", "open")
    .order("created_at")
    .limit(100);
  if (type !== "all") query = query.eq("target_type", type);
  const { data, error } = await query;
  if (error) return <AdminError message={error.message} />;

  const idsOf = (t: string) => [...new Set((data ?? []).filter((c) => c.target_type === t).map((c) => String(c.target_id)))];
  const svcIds = idsOf("service_listing");
  const jobIds = idsOf("job_listing");
  const [svc, jobs] = await Promise.all([
    svcIds.length ? db.from("service_listings").select("id, title, provider_name, phone, status").in("id", svcIds) : { data: [], error: null },
    jobIds.length ? db.from("job_listings").select("id, title, employer_name, phone, status").in("id", jobIds) : { data: [], error: null },
  ]);
  if (svc.error) return <AdminError message={svc.error.message} />;
  if (jobs.error) return <AdminError message={jobs.error.message} />;
  const byId = new Map<string, Target>();
  for (const l of svc.data ?? []) {
    byId.set(`service_listing:${l.id}`, {
      id: String(l.id),
      title: String(l.title),
      who: String(l.provider_name),
      phone: String(l.phone),
      status: String(l.status),
      href: `/admin/services/${l.id}`,
      statusLabel: SERVICE_STATUS[String(l.status) as keyof typeof SERVICE_STATUS],
    });
  }
  for (const l of jobs.data ?? []) {
    byId.set(`job_listing:${l.id}`, {
      id: String(l.id),
      title: String(l.title),
      who: String(l.employer_name),
      phone: String(l.phone),
      status: String(l.status),
      href: `/admin/jobs/${l.id}`,
      statusLabel: JOB_STATUS[String(l.status) as keyof typeof JOB_STATUS],
    });
  }

  return (
    <>
      <PageHeader
        title="Жалобы на объявления"
        description="Жалобы читателей на объявления мастеров и вакансии. Мошенничество показано первым в очереди модерации."
        actions={
          <Link href="/admin/moderation" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Модерация
          </Link>
        }
      />
      <nav aria-label="Раздел" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(TYPES) as TypeFilter[]).map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/admin/complaints" : `/admin/complaints?type=${t}`}
            aria-current={t === type ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium",
              t === type ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {TYPES[t]}
          </Link>
        ))}
      </nav>
      {(data ?? []).length === 0 ? (
        <Empty>Открытых жалоб нет.</Empty>
      ) : (
        <ul className="grid max-w-4xl grid-cols-1 gap-3">
          {(data ?? []).map((c) => {
            const l = byId.get(`${c.target_type}:${c.target_id}`);
            return (
              <li key={String(c.id)} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Badge tone={c.reason === "fraud" ? "danger" : "warning"}>{COMPLAINT_REASON[String(c.reason)] ?? String(c.reason)}</Badge>
                  <Badge tone="outline">{c.target_type === "job_listing" ? "Вакансия" : "Услуга"}</Badge>
                  <span>{fmtDate(String(c.created_at))}</span>
                  <span>{c.reporter_id ? "От зарегистрированного пользователя" : "Анонимно"}</span>
                </div>
                {l ? (
                  <p className="text-sm">
                    <Link href={l.href} className="font-semibold hover:underline">
                      {l.title}
                    </Link>{" "}
                    · {l.who} · {l.phone} {l.statusLabel && <Badge tone={l.statusLabel.tone}>{l.statusLabel.label}</Badge>}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Объявление удалено</p>
                )}
                {c.message && <p className="whitespace-pre-line text-sm">{String(c.message)}</p>}
                <ComplaintActions id={String(c.id)} canHide={!!l && l.status !== "archived"} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
