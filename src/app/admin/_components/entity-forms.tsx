"use client";

import { saveBranch, saveCategory, saveSettings, saveStore, setRole } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { ActionForm, Check, useAdminAction } from "./forms";

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </label>
  );
}

const VERIFICATION = (
  <>
    <option value="needs_check">Требует проверки</option>
    <option value="unverified">Не проверено</option>
    <option value="verified">Проверено</option>
  </>
);

export type CategoryValues = { id: string; slug: string; name_ru: string; name_kk: string; icon: string; sort_order: number; is_active: boolean };

export function CategoryForm({ v }: { v?: CategoryValues }) {
  return (
    <ActionForm action={saveCategory} resetOnSuccess={!v} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {(pending) => (
        <>
          {v && <input type="hidden" name="id" value={v.id} />}
          <F label="Название RU"><Input name="name_ru" required defaultValue={v?.name_ru} className="h-10" /></F>
          <F label="Название KZ"><Input name="name_kk" required defaultValue={v?.name_kk} className="h-10" /></F>
          <F label="Слаг"><Input name="slug" required pattern="[a-z0-9\-]{2,64}" defaultValue={v?.slug} className="h-10" /></F>
          <F label="Иконка (lucide)"><Input name="icon" required defaultValue={v?.icon ?? "package"} className="h-10" /></F>
          <F label="Порядок"><Input name="sort_order" type="number" min={0} defaultValue={v?.sort_order ?? 100} className="h-10" /></F>
          <div className="flex items-end justify-between gap-2">
            <Check name="is_active" label="Активна" defaultChecked={v?.is_active ?? true} />
            <Button size="sm" disabled={pending}>{v ? "Сохранить" : "Добавить"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export type StoreValues = { id: string; slug: string; name: string; website: string; verification_status: string; is_active: boolean; sort_order: number };

export function StoreForm({ v }: { v?: StoreValues }) {
  return (
    <ActionForm action={saveStore} resetOnSuccess={!v} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {(pending) => (
        <>
          {v && <input type="hidden" name="id" value={v.id} />}
          <F label="Название сети"><Input name="name" required defaultValue={v?.name} className="h-10" /></F>
          <F label="Слаг"><Input name="slug" required pattern="[a-z0-9\-]{2,64}" defaultValue={v?.slug} className="h-10" /></F>
          <F label="Сайт (https://)"><Input name="website" type="url" defaultValue={v?.website} className="h-10" /></F>
          <F label="Проверка"><NativeSelect name="verification_status" defaultValue={v?.verification_status ?? "needs_check"} className="h-10">{VERIFICATION}</NativeSelect></F>
          <F label="Порядок"><Input name="sort_order" type="number" min={0} defaultValue={v?.sort_order ?? 100} className="h-10" /></F>
          <div className="flex items-end justify-between gap-2">
            <Check name="is_active" label="Активен" defaultChecked={v?.is_active ?? true} />
            <Button size="sm" disabled={pending}>{v ? "Сохранить" : "Добавить"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export type BranchValues = {
  id: string;
  store_id: string;
  city_id: string;
  slug: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  opening_hours: string;
  phone: string;
  verification_status: string;
  is_active: boolean;
};

export function BranchForm({ v, storeId, cities }: { v?: BranchValues; storeId: string; cities: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveBranch} resetOnSuccess={!v} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(pending) => (
        <>
          {v && <input type="hidden" name="id" value={v.id} />}
          <input type="hidden" name="store_id" value={storeId} />
          <F label="Название филиала"><Input name="name" required defaultValue={v?.name} className="h-10" /></F>
          <F label="Слаг"><Input name="slug" required pattern="[a-z0-9\-]{2,96}" defaultValue={v?.slug} className="h-10" /></F>
          <F label="Город">
            <NativeSelect name="city_id" defaultValue={v?.city_id ?? cities[0]?.id} className="h-10">
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </F>
          <F label="Проверка"><NativeSelect name="verification_status" defaultValue={v?.verification_status ?? "needs_check"} className="h-10">{VERIFICATION}</NativeSelect></F>
          <F label="Адрес (только проверенный)" className="sm:col-span-2"><Input name="address" defaultValue={v?.address} className="h-10" /></F>
          <F label="Широта"><Input name="latitude" inputMode="decimal" defaultValue={v?.latitude} className="h-10" /></F>
          <F label="Долгота"><Input name="longitude" inputMode="decimal" defaultValue={v?.longitude} className="h-10" /></F>
          <F label="Часы работы" className="sm:col-span-2"><Input name="opening_hours" defaultValue={v?.opening_hours} className="h-10" /></F>
          <F label="Телефон"><Input name="phone" type="tel" defaultValue={v?.phone} className="h-10" /></F>
          <div className="flex items-end justify-between gap-2">
            <Check name="is_active" label="Активен" defaultChecked={v?.is_active ?? true} />
            <Button size="sm" disabled={pending}>{v ? "Сохранить" : "Добавить филиал"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export type SettingsValues = {
  price_stale_days: number;
  anomaly_threshold_pct: number;
  submission_limit_anon_hour: number;
  submission_limit_user_hour: number;
  demo_mode: boolean;
};

export function SettingsForm({ v }: { v: SettingsValues }) {
  return (
    <ActionForm action={saveSettings} className="grid grid-cols-1 max-w-2xl gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
      {(pending) => (
        <>
          <F label="Цена устаревает через, дней"><Input name="price_stale_days" type="number" min={1} max={365} defaultValue={v.price_stale_days} /></F>
          <F label="Порог аномалии, % от медианы"><Input name="anomaly_threshold_pct" type="number" min={5} max={500} defaultValue={v.anomaly_threshold_pct} /></F>
          <F label="Лимит заявок в час (аноним)"><Input name="submission_limit_anon_hour" type="number" min={0} max={1000} defaultValue={v.submission_limit_anon_hour} /></F>
          <F label="Лимит заявок в час (пользователь)"><Input name="submission_limit_user_hour" type="number" min={0} max={1000} defaultValue={v.submission_limit_user_hour} /></F>
          <div className="sm:col-span-2">
            <Check name="demo_mode" label="Показывать DEMO-магазины на сайте" defaultChecked={v.demo_mode} />
            <p className="mt-1 text-xs text-muted-foreground">
              DEMO-данные всегда помечены и не попадают в рейтинги реальных магазинов. Перед публичным запуском выключите и удалите их скриптом supabase/seed/demo_remove.sql.
            </p>
          </div>
          <Button className="w-fit" disabled={pending}>Сохранить</Button>
        </>
      )}
    </ActionForm>
  );
}

export function RoleToggle({ userId, role, has, disabled }: { userId: string; role: "moderator" | "admin"; has: boolean; disabled?: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <Button
      size="sm"
      variant={has ? "soft" : "outline"}
      disabled={pending || disabled}
      aria-pressed={has}
      onClick={() => {
        if (has && !confirm(`Снять роль «${role === "admin" ? "администратор" : "модератор"}»?`)) return;
        run(() => setRole(userId, role, !has));
      }}
    >
      {role === "admin" ? "Админ" : "Модератор"}
      {has ? " ✓" : ""}
    </Button>
  );
}
