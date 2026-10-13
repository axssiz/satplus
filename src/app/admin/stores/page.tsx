import { Badge } from "@/components/ui/badge";
import { AdminError, PageHeader } from "../_components/ui";
import { adminPage } from "../_components/data";
import { BranchForm, StoreForm } from "../_components/entity-forms";

export const metadata = { title: "Магазины и филиалы" };

const s = (v: unknown) => (v == null ? "" : String(v));

export default async function StoresPage() {
  const { db } = await adminPage("admin");
  const [{ data: stores, error }, { data: branches, error: bErr }, { data: cities }] = await Promise.all([
    db.from("stores").select("id, slug, name, website, verification_status, is_active, is_demo, sort_order").order("sort_order").order("name"),
    db.from("store_branches").select("*").order("name"),
    db.from("cities").select("id, name_ru").order("name_ru"),
  ]);
  if (error || bErr) return <AdminError message={(error ?? bErr)!.message} />;
  const cityOptions = (cities ?? []).map((c) => ({ id: String(c.id), name: String(c.name_ru) }));

  return (
    <>
      <PageHeader
        title="Магазины и филиалы"
        description="Сеть и каждый её филиал — отдельные записи. Адрес, часы и телефон заполняйте только после проверки; пустые поля на сайте показываются как «не уточнено»."
      />
      <section className="mb-6 rounded-2xl border border-primary/30 bg-card p-4">
        <h2 className="mb-3 font-semibold">Новая сеть</h2>
        <StoreForm />
      </section>
      <div className="grid grid-cols-1 gap-4">
        {(stores ?? []).map((st) => {
          const own = (branches ?? []).filter((b) => b.store_id === st.id);
          return (
            <details key={String(st.id)} className="group rounded-2xl border border-border bg-card">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-4">
                <span className="font-semibold">{String(st.name)}</span>
                <span className="text-xs text-muted-foreground">филиалов: {own.length}</span>
                {st.is_demo && <Badge tone="demo">DEMO</Badge>}
                {!st.is_active && <Badge>скрыт</Badge>}
                {st.verification_status !== "verified" && <Badge tone="warning">требует проверки</Badge>}
              </summary>
              <div className="grid grid-cols-1 gap-4 border-t border-border p-4">
                {st.is_demo ? (
                  <p className="text-sm text-muted-foreground">DEMO-магазин создаётся и удаляется только скриптами демо-данных.</p>
                ) : (
                  <>
                    <StoreForm
                      v={{
                        id: String(st.id),
                        slug: String(st.slug),
                        name: String(st.name),
                        website: s(st.website),
                        verification_status: String(st.verification_status),
                        is_active: !!st.is_active,
                        sort_order: Number(st.sort_order),
                      }}
                    />
                    {own.map((b) => (
                      <div key={String(b.id)} className="rounded-xl border border-border bg-surface p-3">
                        <p className="mb-2 text-sm font-medium">{String(b.name)}</p>
                        <BranchForm
                          storeId={String(st.id)}
                          cities={cityOptions}
                          v={{
                            id: String(b.id),
                            store_id: String(b.store_id),
                            city_id: String(b.city_id),
                            slug: String(b.slug),
                            name: String(b.name),
                            address: s(b.address),
                            latitude: s(b.latitude),
                            longitude: s(b.longitude),
                            opening_hours: s(b.opening_hours),
                            phone: s(b.phone),
                            verification_status: String(b.verification_status),
                            is_active: !!b.is_active,
                          }}
                        />
                      </div>
                    ))}
                    <div className="rounded-xl border border-dashed border-border p-3">
                      <p className="mb-2 text-sm font-medium">Новый филиал</p>
                      <BranchForm storeId={String(st.id)} cities={cityOptions} />
                    </div>
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
