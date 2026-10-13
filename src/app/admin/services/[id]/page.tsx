import Link from "next/link";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/config/features";
import { storagePublicUrl } from "@/lib/env";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate } from "../../_components/data";
import { ModerateListing } from "../moderate-listing";
import { SERVICE_STATUS, ServicesFlagNotice } from "../shared";
import { StaffServiceForm, type StaffServiceFormValues } from "./service-form";

export const metadata = { title: "Объявление об услуге" };

const s = (v: unknown) => (v == null ? "" : String(v));

export default async function AdminServiceEditPage({ params }: PageProps<"/admin/services/[id]">) {
  const { db, user } = await adminPage();
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();

  const cats = await db.from("service_categories").select("id, name_ru, is_active").order("sort_order");
  if (cats.error) return <AdminError message={cats.error.message} />;

  let values: StaffServiceFormValues = {
    id: null,
    slug: "",
    categoryId: "",
    title: "",
    providerName: "",
    description: "",
    priceNote: "",
    area: "",
    phone: "",
    hasWhatsapp: false,
    linkUrl: "",
    coverUrl: null,
    coverAlt: "",
    sourceName: "",
    status: "published",
    expiresOn: "",
    isSponsored: false,
    hasOwner: false,
  };
  let meta: { status: keyof typeof SERVICE_STATUS; createdAt: string; rejectReason: string | null; slug: string } | null = null;

  if (!isNew) {
    const { data: r, error } = await db.from("service_listings").select("*").eq("id", id).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!r) notFound();
    meta = { status: r.status as keyof typeof SERVICE_STATUS, createdAt: String(r.created_at), rejectReason: (r.reject_reason as string | null) ?? null, slug: String(r.slug) };
    values = {
      id: String(r.id),
      slug: String(r.slug),
      categoryId: s(r.category_id),
      title: String(r.title),
      providerName: String(r.provider_name),
      description: String(r.description),
      priceNote: s(r.price_note),
      area: s(r.area),
      phone: String(r.phone),
      hasWhatsapp: !!r.has_whatsapp,
      linkUrl: s(r.link_url),
      coverUrl: storagePublicUrl("service-images", r.cover_path as string | null),
      coverAlt: s(r.cover_alt),
      sourceName: s(r.source_name),
      // Rejected listings can only be corrected back into review; the owner sees the result.
      status: r.status === "rejected" ? "pending" : (r.status as StaffServiceFormValues["status"]),
      expiresOn: s(r.expires_on),
      isSponsored: !!r.is_sponsored,
      hasOwner: !!r.owner_id,
    };
  }

  const st = meta ? SERVICE_STATUS[meta.status] : null;
  return (
    <>
      <PageHeader
        title={isNew ? "Объявление из проверенного источника" : "Объявление об услуге"}
        description={
          isNew
            ? "Добавляйте мастера только с его согласия на публикацию телефона и с указанием источника."
            : values.hasOwner
              ? "Объявление мастера. Исправляйте только явные ошибки; по существу лучше отклонить с причиной, чтобы мастер исправил сам."
              : "Объявление добавлено редакцией из источника."
        }
        actions={
          <Link href="/admin/services" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все объявления
          </Link>
        }
      />
      <ServicesFlagNotice enabled={isFeatureEnabled("services")} />
      {meta && st && (
        <section className="mb-6 max-w-4xl space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <p>
            Статус: <strong>{st.label}</strong> · создано {fmtDate(meta.createdAt)}
            {meta.status === "published" && (
              <>
                {" · "}
                <a href={`/services/${meta.slug}`} target="_blank" rel="noreferrer" className="text-primary-strong hover:underline dark:text-primary">
                  открыть на сайте
                </a>
              </>
            )}
          </p>
          {meta.rejectReason && <p className="text-danger">Причина отклонения: {meta.rejectReason}</p>}
          {meta.status === "pending" && <ModerateListing id={values.id!} />}
        </section>
      )}
      <StaffServiceForm
        values={values}
        categories={(cats.data ?? []).map((c) => ({ id: String(c.id), name: c.is_active ? String(c.name_ru) : `${c.name_ru} (скрыта)` }))}
        isAdmin={user.isAdmin}
      />
    </>
  );
}
