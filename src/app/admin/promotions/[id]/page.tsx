import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, Inbox } from "lucide-react";
import { isFeatureEnabled } from "@/config/features";
import { storagePublicUrl } from "@/lib/env";
import { slugify } from "@/lib/news/text";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate, one } from "../../_components/data";
import { RejectReport } from "../reports/reject-report";
import { PromotionsFlagNotice } from "../shared";
import { PromotionForm, type PromotionFormValues } from "./promotion-form";

export const metadata = { title: "Акция" };

const UUID = /^[0-9a-f-]{36}$/;

export default async function PromotionEditPage({ params, searchParams }: PageProps<"/admin/promotions/[id]">) {
  const { db, user } = await adminPage();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  if (!isNew && !UUID.test(id)) notFound();
  const fromId = isNew && typeof sp.from === "string" && UUID.test(sp.from) ? sp.from : null;

  const [stores, branches, cats] = await Promise.all([
    db.from("stores").select("id, slug, name, is_demo").order("sort_order").order("name"),
    db.from("store_branches").select("id, store_id, name, address").order("name"),
    db.from("product_categories").select("id, name_ru").order("sort_order"),
  ]);
  const listErr = stores.error ?? branches.error ?? cats.error;
  if (listErr) return <AdminError message={listErr.message} />;

  let values: PromotionFormValues = {
    id: null,
    submissionId: null,
    slug: "",
    storeId: "",
    branchId: "",
    categoryId: "",
    title: "",
    description: "",
    discountLabel: "",
    conditions: "",
    startsOn: "",
    endsOn: "",
    sourceName: "",
    sourceUrl: "",
    coverUrl: null,
    coverAlt: "",
    status: "draft",
    isSponsored: false,
  };
  let publicUrl: string | null = null;
  let report: {
    id: string;
    title: string;
    details: string | null;
    store: string;
    endsOn: string | null;
    contact: string | null;
    sourceUrl: string | null;
    createdAt: string;
    status: string;
    photoUrl: string | null;
  } | null = null;

  if (!isNew) {
    const { data: p, error } = await db.from("promotions").select("*").eq("id", id).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!p) notFound();
    values = {
      id: String(p.id),
      submissionId: null,
      slug: String(p.slug),
      storeId: String(p.store_id),
      branchId: (p.branch_id as string | null) ?? "",
      categoryId: (p.category_id as string | null) ?? "",
      title: String(p.title),
      description: (p.description as string | null) ?? "",
      discountLabel: (p.discount_label as string | null) ?? "",
      conditions: (p.conditions as string | null) ?? "",
      startsOn: (p.starts_on as string | null) ?? "",
      endsOn: String(p.ends_on),
      sourceName: String(p.source_name),
      sourceUrl: (p.source_url as string | null) ?? "",
      coverUrl: storagePublicUrl("promotion-images", p.cover_path as string | null),
      coverAlt: (p.cover_alt as string | null) ?? "",
      status: p.status as PromotionFormValues["status"],
      isSponsored: !!p.is_sponsored,
    };
    if (p.status === "published") publicUrl = `/promotions/${p.slug}`;
  } else if (fromId) {
    const { data: s, error } = await db.from("promotion_submissions").select("*, stores(name, slug)").eq("id", fromId).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!s) notFound();
    let photoUrl: string | null = null;
    if (s.photo_path) {
      const { data: signed } = await db.storage.from("promotion-submissions").createSignedUrl(String(s.photo_path), 900);
      photoUrl = signed?.signedUrl ?? null;
    }
    const store = one<{ name: string; slug: string }>(s.stores);
    report = {
      id: String(s.id),
      title: String(s.title),
      details: (s.details as string | null) ?? null,
      store: store?.name ?? `${String(s.store_text)} (нет в справочнике)`,
      endsOn: (s.ends_on as string | null) ?? null,
      contact: (s.contact as string | null) ?? null,
      sourceUrl: (s.source_url as string | null) ?? null,
      createdAt: String(s.created_at),
      status: String(s.status),
      photoUrl,
    };
    values = {
      ...values,
      submissionId: s.status === "pending" ? String(s.id) : null,
      storeId: (s.store_id as string | null) ?? "",
      title: String(s.title),
      slug: slugify([store?.slug, String(s.title)].filter(Boolean).join(" "), 110),
      description: (s.details as string | null) ?? "",
      endsOn: (s.ends_on as string | null) ?? "",
      sourceUrl: (s.source_url as string | null) ?? "",
      sourceName: "Сообщение покупателя, проверено модератором Sat+",
    };
  }

  return (
    <>
      <PageHeader
        title={isNew ? (report ? "Публикация сообщения об акции" : "Новая акция") : "Редактирование акции"}
        description={
          report
            ? "Проверьте акцию (сайт сети, звонок в магазин, фото), уточните сроки. Сообщение будет отмечено опубликованным вместе с сохранением акции."
            : "Акцию без магазина, даты окончания и источника опубликовать нельзя."
        }
        actions={
          <Link href="/admin/promotions" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все акции
          </Link>
        }
      />
      <PromotionsFlagNotice enabled={isFeatureEnabled("promotions")} />

      {report && (
        <section className="mb-6 max-w-4xl space-y-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Inbox className="size-4" aria-hidden /> Исходное сообщение · {fmtDate(report.createdAt)}
          </h2>
          {report.status !== "pending" && (
            <p className="font-medium text-warning-foreground">Это сообщение уже обработано ({report.status === "approved" ? "опубликовано" : "отклонено"}).</p>
          )}
          <p>
            <span className="text-muted-foreground">Магазин:</span> {report.store}
          </p>
          <p className="font-medium">{report.title}</p>
          {report.details && <p className="whitespace-pre-line text-muted-foreground">{report.details}</p>}
          {report.endsOn && (
            <p className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden /> По словам покупателя, до {report.endsOn}
            </p>
          )}
          {report.sourceUrl && (
            <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-primary-strong hover:underline dark:text-primary">
              {report.sourceUrl} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {report.contact && <p>Контакт (не публикуется): {report.contact}</p>}
          {report.photoUrl && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Фото покупателя (личный бакет, ссылка действует 15 минут). Не публикуйте его без разрешения автора.</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
              <img src={report.photoUrl} alt="Фото из сообщения" className="max-h-80 rounded-xl border border-border" />
            </div>
          )}
          {report.status === "pending" && <RejectReport id={report.id} redirectTo="/admin/promotions/reports" />}
        </section>
      )}

      <PromotionForm
        values={values}
        stores={(stores.data ?? []).map((s) => ({ id: String(s.id), slug: String(s.slug), name: s.is_demo ? `${s.name} (DEMO)` : String(s.name) }))}
        branches={(branches.data ?? []).map((b) => ({
          id: String(b.id),
          storeId: String(b.store_id),
          name: b.address ? `${b.name}, ${b.address}` : String(b.name),
        }))}
        categories={(cats.data ?? []).map((c) => ({ id: String(c.id), name: String(c.name_ru) }))}
        isAdmin={user.isAdmin}
        publicUrl={publicUrl}
      />
    </>
  );
}
