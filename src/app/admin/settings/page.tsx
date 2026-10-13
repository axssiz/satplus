import { AdminError, PageHeader } from "../_components/ui";
import { adminPage } from "../_components/data";
import { SettingsForm } from "../_components/entity-forms";
import { features, isFeatureEnabled, type FeatureKey } from "@/config/features";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const { db } = await adminPage("admin");
  const { data, error } = await db.from("app_settings").select("key, value");
  if (error) return <AdminError message={error.message} />;
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value;

  return (
    <>
      <PageHeader title="Настройки" description="Параметры QaiArzan, которые применяются сразу без перевыпуска сайта." />
      <SettingsForm
        v={{
          price_stale_days: Number(get("price_stale_days") ?? 14),
          anomaly_threshold_pct: Number(get("anomaly_threshold_pct") ?? 40),
          submission_limit_anon_hour: Number(get("submission_limit_anon_hour") ?? 5),
          submission_limit_user_hour: Number(get("submission_limit_user_hour") ?? 30),
          demo_mode: get("demo_mode") === true,
        }}
      />
      <section className="mt-8 max-w-2xl rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Разделы Sat+ (feature flags)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Меняются в src/config/features.ts или переменными окружения NEXT_PUBLIC_FEATURE_&lt;КЛЮЧ&gt;=true|false с последующим перевыпуском.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {(Object.keys(features) as FeatureKey[]).map((k) => [k, isFeatureEnabled(k)] as const).map(([k, on]) => (
            <li key={k} className="flex justify-between rounded-lg bg-surface px-2.5 py-1.5">
              <code>{k}</code>
              <span className={on ? "text-primary-strong dark:text-primary" : "text-muted-foreground"}>{on ? "включён" : "в разработке"}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
