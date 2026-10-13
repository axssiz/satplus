import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Inbox } from "lucide-react";
import { isFeatureEnabled } from "@/config/features";
import { storagePublicUrl } from "@/lib/env";
import { slugify } from "@/lib/news/text";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate, one } from "../../_components/data";
import { BusinessesFlagNotice } from "../shared";
import { RejectBusinessSuggestion } from "../suggestions/reject-suggestion";
import { BusinessForm, type BusinessFormValues } from "./business-form";

export const metadata = { title: "Организация" };

const UUID = /^[0-9a-f-]{36}$/;
const s = (v: unknown) => (v == null ? "" : String(v));

type Suggestion = {
  id: string;
  kind: "new" | "correction";
  name: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  details: string | null;
  isOwner: boolean;
  contact: string | null;
  createdAt: string;
  status: string;
  photoUrl: string | null;
};

export default async function BusinessEditPage({ params, searchParams }: PageProps<"/admin/businesses/[id]">) {
  const { db, user } = await adminPage();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  if (!isNew && !UUID.test(id)) notFound();
  const fromId = typeof sp.from === "string" && UUID.test(sp.from) ? sp.from : null;

  const cats = await db.from("business_categories").select("id, name_ru, is_active").order("sort_order");
  if (cats.error) return <AdminError message={cats.error.message} />;

  let values: BusinessFormValues = {
    id: null,
    submissionId: null,
    slug: "",
    name: "",
    categoryId: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    phone: "",
    phoneAlt: "",
    website: "",
    socialUrl: "",
    openingHours: "",
    coverUrl: null,
    coverAlt: "",
    sourceName: "",
    verified: false,
    lastVerifiedAt: "",
    status: "draft",
    isSponsored: false,
  };
  let publicUrl: string | null = null;

  if (!isNew) {
    const { data: b, error } = await db.from("businesses").select("*").eq("id", id).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!b) notFound();
    values = {
      id: String(b.id),
      submissionId: null,
      slug: String(b.slug),
      name: String(b.name),
      categoryId: s(b.category_id),
      description: s(b.description),
      address: s(b.address),
      latitude: s(b.latitude),
      longitude: s(b.longitude),
      phone: s(b.phone),
      phoneAlt: s(b.phone_alt),
      website: s(b.website),
      socialUrl: s(b.social_url),
      openingHours: s(b.opening_hours),
      coverUrl: storagePublicUrl("business-images", b.cover_path as string | null),
      coverAlt: s(b.cover_alt),
      sourceName: String(b.source_name),
      verified: b.verification_status === "verified",
      lastVerifiedAt: s(b.last_verified_at),
      status: b.status as BusinessFormValues["status"],
      isSponsored: !!b.is_sponsored,
    };
    if (b.status === "published") publicUrl = `/businesses/${b.slug}`;
  }

  let suggestion: Suggestion | null = null;
  if (fromId) {
    const { data: r, error } = await db.from("business_submissions").select("*, business_categories(name_ru)").eq("id", fromId).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    // A correction is opened on its organisation's page, a new suggestion on /new; anything else is a stale link.
    if (!r || (isNew ? r.kind !== "new" : r.kind !== "correction" || r.business_id !== id)) notFound();
    let photoUrl: string | null = null;
    if (r.photo_path) {
      const { data: signed } = await db.storage.from("business-submissions").createSignedUrl(String(r.photo_path), 900);
      photoUrl = signed?.signedUrl ?? null;
    }
    suggestion = {
      id: String(r.id),
      kind: r.kind as Suggestion["kind"],
      name: (r.name as string | null) ?? null,
      category: one<{ name_ru: string }>(r.business_categories)?.name_ru ?? null,
      address: (r.address as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      website: (r.website as string | null) ?? null,
      openingHours: (r.opening_hours as string | null) ?? null,
      details: (r.details as string | null) ?? null,
      isOwner: !!r.is_owner,
      contact: (r.contact as string | null) ?? null,
      createdAt: String(r.created_at),
      status: String(r.status),
      photoUrl,
    };
    if (r.status === "pending") values = { ...values, submissionId: String(r.id) };
    if (isNew) {
      values = {
        ...values,
        name: s(r.name),
        slug: slugify(s(r.name), 110),
        categoryId: s(r.category_id),
        address: s(r.address),
        phone: s(r.phone),
        website: s(r.website),
        openingHours: s(r.opening_hours),
        description: "",
        sourceName: r.is_owner ? "Сведения от представителя организации, проверено модератором Sat+" : "Сообщение читателя, проверено модератором Sat+",
      };
    }
  }

  return (
    <>
      <PageHeader
        title={isNew ? (suggestion ? "Публикация новой организации" : "Новая организация") : suggestion ? "Исправление организации" : "Редактирование организации"}
        description={
          suggestion
            ? "Проверьте сведения (звонок, вывеска, официальный сайт). Сообщение будет отмечено обработанным вместе с сохранением карточки."
            : "Не вносите данные, которые не проверены. Источник обязателен; отметка «проверено» ставится только с датой проверки."
        }
        actions={
          <Link href={suggestion ? "/admin/businesses/suggestions" : "/admin/businesses"} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {suggestion ? "← Сообщения" : "← Все организации"}
          </Link>
        }
      />
      <BusinessesFlagNotice enabled={isFeatureEnabled("businesses")} />

      {suggestion && (
        <section className="mb-6 max-w-4xl space-y-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Inbox className="size-4" aria-hidden /> {suggestion.kind === "correction" ? "Сообщение об ошибке" : "Предложение читателя"} · {fmtDate(suggestion.createdAt)}
          </h2>
          {suggestion.status !== "pending" && (
            <p className="font-medium text-warning-foreground">Это сообщение уже обработано ({suggestion.status === "approved" ? "принято" : "отклонено"}).</p>
          )}
          {suggestion.isOwner && <p className="font-medium">Автор указал, что представляет организацию.</p>}
          {suggestion.name && <p className="font-medium">{suggestion.name}</p>}
          <dl className="grid gap-1 sm:grid-cols-2">
            {suggestion.category && <div><dt className="inline text-muted-foreground">Категория: </dt><dd className="inline">{suggestion.category}</dd></div>}
            {suggestion.address && <div><dt className="inline text-muted-foreground">Адрес: </dt><dd className="inline">{suggestion.address}</dd></div>}
            {suggestion.phone && <div><dt className="inline text-muted-foreground">Телефон: </dt><dd className="inline">{suggestion.phone}</dd></div>}
            {suggestion.openingHours && <div><dt className="inline text-muted-foreground">График: </dt><dd className="inline">{suggestion.openingHours}</dd></div>}
          </dl>
          {suggestion.website && (
            <a href={suggestion.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-primary-strong hover:underline dark:text-primary">
              {suggestion.website} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {suggestion.details && <p className="whitespace-pre-line text-muted-foreground">{suggestion.details}</p>}
          {suggestion.contact && <p>Контакт (не публикуется): {suggestion.contact}</p>}
          {suggestion.photoUrl && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Фото из сообщения (личный бакет, ссылка действует 15 минут). Не публикуйте его без разрешения автора.</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
              <img src={suggestion.photoUrl} alt="Фото из сообщения" className="max-h-80 rounded-xl border border-border" />
            </div>
          )}
          {suggestion.status === "pending" && <RejectBusinessSuggestion id={suggestion.id} redirectTo="/admin/businesses/suggestions" />}
        </section>
      )}

      <BusinessForm
        values={values}
        categories={(cats.data ?? []).map((c) => ({ id: String(c.id), name: c.is_active ? String(c.name_ru) : `${c.name_ru} (скрыта)` }))}
        isAdmin={user.isAdmin}
        publicUrl={publicUrl}
      />
    </>
  );
}
