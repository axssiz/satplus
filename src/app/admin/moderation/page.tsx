import Link from "next/link";
import { BadgePercent, Briefcase, Building2, MessageSquareWarning, Newspaper, Wrench } from "lucide-react";
import { AdminError, PageHeader } from "../_components/ui";
import { adminPage, one, unitRu } from "../_components/data";
import { ModerationBoard, type QueueReport, type QueueSubmission } from "./moderation-board";

export const metadata = { title: "Модерация" };

export default async function ModerationPage() {
  const { db } = await adminPage();

  const [subsRes, reportsRes, newsRes, promoRes, bizRes, svcRes, jobRes, complaintRes] = await Promise.all([
    db
      .from("price_submissions")
      .select(
        "id, kind, price, pack_quantity, pack_unit, brand_label, observed_at, comment, user_id, source, reference_price, is_anomalous, anomaly_reason, created_at, products(id, slug, name_ru, comparison_mode), store_branches(id, name, stores(name, is_demo))",
      )
      .eq("status", "pending")
      .order("is_anomalous", { ascending: false })
      .order("created_at")
      .limit(100),
    db.from("reports").select("id, target_type, target_id, reason, message, created_at").eq("status", "open").order("created_at").limit(100),
    db.from("news_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("promotion_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("business_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("service_listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("job_listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("listing_complaints").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (subsRes.error) return <AdminError message={subsRes.error.message} />;
  if (reportsRes.error) return <AdminError message={reportsRes.error.message} />;

  const subIds = (subsRes.data ?? []).map((s) => String(s.id));
  const { data: evidence } = subIds.length
    ? await db.from("price_evidence").select("submission_id, storage_path, kind, redacted_by_user").in("submission_id", subIds)
    : { data: [] };
  const evidenceBySub = new Map<string, QueueSubmission["evidence"]>();
  for (const e of evidence ?? []) {
    const { data: signed } = await db.storage.from("price-evidence").createSignedUrl(String(e.storage_path), 900);
    if (!signed?.signedUrl) continue;
    const list = evidenceBySub.get(String(e.submission_id)) ?? [];
    list.push({ url: signed.signedUrl, kind: String(e.kind), redacted: Boolean(e.redacted_by_user) });
    evidenceBySub.set(String(e.submission_id), list);
  }

  // Reputation of submitters helps moderators weigh trust.
  const userIds = [...new Set((subsRes.data ?? []).map((s) => s.user_id).filter(Boolean) as string[])];
  const { data: reps } = userIds.length ? await db.from("user_reputation").select("user_id, points, approved_actions").in("user_id", userIds) : { data: [] };
  const repMap = new Map((reps ?? []).map((r) => [String(r.user_id), `${r.points} балл. · одобрено ${r.approved_actions}`]));

  const submissions: QueueSubmission[] = (subsRes.data ?? []).map((s) => {
    const p = one<{ id: string; slug: string; name_ru: string; comparison_mode: string }>(s.products);
    const b = one<{ id: string; name: string; stores: unknown }>(s.store_branches);
    const st = one<{ name: string; is_demo: boolean }>(b?.stores);
    return {
      id: String(s.id),
      kind: s.kind as "new" | "confirm",
      price: Number(s.price),
      pack: s.pack_quantity ? `${Number(s.pack_quantity)} ${unitRu(s.pack_unit)}` : null,
      brandLabel: (s.brand_label as string | null) ?? null,
      observedAt: String(s.observed_at),
      createdAt: String(s.created_at),
      comment: (s.comment as string | null) ?? null,
      author: s.user_id ? (repMap.get(String(s.user_id)) ?? "Пользователь, 0 балл.") : "Аноним",
      referencePrice: s.reference_price == null ? null : Number(s.reference_price),
      isAnomalous: Boolean(s.is_anomalous),
      anomalyReason: (s.anomaly_reason as string | null) ?? null,
      product: p ? { slug: p.slug, name: p.name_ru, analog: p.comparison_mode === "analog" } : null,
      branch: b ? `${st?.name ?? ""} · ${b.name}` : "—",
      evidence: evidenceBySub.get(String(s.id)) ?? [],
    };
  });

  // Resolve report targets to readable labels.
  const reportRows = reportsRes.data ?? [];
  const byType = (t: string) => reportRows.filter((r) => r.target_type === t).map((r) => String(r.target_id));
  const [prodT, priceT, branchT] = await Promise.all([
    byType("product").length ? db.from("products").select("id, name_ru, slug").in("id", byType("product")) : Promise.resolve({ data: [] }),
    byType("verified_price").length
      ? db.from("current_prices").select("id, price, store_name, branch_name, product_id").in("id", byType("verified_price"))
      : Promise.resolve({ data: [] }),
    byType("store_branch").length ? db.from("store_branches").select("id, name, stores(name)").in("id", byType("store_branch")) : Promise.resolve({ data: [] }),
  ]);
  const priceProductIds = (priceT.data ?? []).map((p) => String(p.product_id));
  const { data: priceProducts } = priceProductIds.length ? await db.from("products").select("id, name_ru").in("id", priceProductIds) : { data: [] };
  const ppName = new Map((priceProducts ?? []).map((p) => [String(p.id), String(p.name_ru)]));
  const labels = new Map<string, string>();
  for (const p of prodT.data ?? []) labels.set(String(p.id), `Товар: ${p.name_ru}`);
  for (const p of priceT.data ?? []) labels.set(String(p.id), `Цена ${Number(p.price)} ₸ — ${ppName.get(String(p.product_id)) ?? ""}, ${p.store_name} · ${p.branch_name}`);
  for (const b of branchT.data ?? []) labels.set(String(b.id), `Филиал: ${one<{ name: string }>(b.stores)?.name ?? ""} · ${b.name}`);

  const reports: QueueReport[] = reportRows.map((r) => ({
    id: String(r.id),
    targetType: r.target_type as QueueReport["targetType"],
    targetId: String(r.target_id),
    targetLabel: labels.get(String(r.target_id)) ?? "Объект удалён",
    targetExists: labels.has(String(r.target_id)),
    reason: String(r.reason),
    message: (r.message as string | null) ?? null,
    createdAt: String(r.created_at),
  }));

  return (
    <>
      <PageHeader
        title="Модерация"
        description="Пользовательские цены попадают на сайт только после одобрения. Подозрительные заявки (сильное отклонение от медианы) показаны первыми."
      />
      {(newsRes.count ?? 0) > 0 && (
        <Link
          href="/admin/news/suggestions"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm font-medium hover:bg-info-soft/60"
        >
          <Newspaper className="size-5 shrink-0 text-info" aria-hidden />
          Предложения новостей от читателей: {newsRes.count}
          <span className="ml-auto text-primary-strong dark:text-primary">Открыть →</span>
        </Link>
      )}
      {(promoRes.count ?? 0) > 0 && (
        <Link
          href="/admin/promotions/reports"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm font-medium hover:bg-info-soft/60"
        >
          <BadgePercent className="size-5 shrink-0 text-info" aria-hidden />
          Сообщения об акциях от покупателей: {promoRes.count}
          <span className="ml-auto text-primary-strong dark:text-primary">Открыть →</span>
        </Link>
      )}
      {(bizRes.count ?? 0) > 0 && (
        <Link
          href="/admin/businesses/suggestions"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm font-medium hover:bg-info-soft/60"
        >
          <Building2 className="size-5 shrink-0 text-info" aria-hidden />
          Сообщения об организациях: {bizRes.count}
          <span className="ml-auto text-primary-strong dark:text-primary">Открыть →</span>
        </Link>
      )}
      {(svcRes.count ?? 0) > 0 && (
        <Link
          href="/admin/services"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm font-medium hover:bg-info-soft/60"
        >
          <Wrench className="size-5 shrink-0 text-info" aria-hidden />
          Объявления об услугах на проверке: {svcRes.count}
          <span className="ml-auto text-primary-strong dark:text-primary">Открыть →</span>
        </Link>
      )}
      {(jobRes.count ?? 0) > 0 && (
        <Link
          href="/admin/jobs"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm font-medium hover:bg-info-soft/60"
        >
          <Briefcase className="size-5 shrink-0 text-info" aria-hidden />
          Вакансии на проверке: {jobRes.count}
          <span className="ml-auto text-primary-strong dark:text-primary">Открыть →</span>
        </Link>
      )}
      {(complaintRes.count ?? 0) > 0 && (
        <Link
          href="/admin/complaints"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm font-medium hover:bg-warning-soft/70"
        >
          <MessageSquareWarning className="size-5 shrink-0 text-warning" aria-hidden />
          Жалобы на объявления: {complaintRes.count}
          <span className="ml-auto text-primary-strong dark:text-primary">Открыть →</span>
        </Link>
      )}
      <ModerationBoard submissions={submissions} reports={reports} />
    </>
  );
}
