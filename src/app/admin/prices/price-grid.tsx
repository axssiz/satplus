"use client";

import { Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { removePrice, savePrices, type PriceItemInput } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import type { BranchOption } from "../_components/data";
import { useAdminAction } from "../_components/forms";

export type GridRow = {
  key: string;
  productId: string;
  branchId: string;
  productName: string;
  productSlug: string;
  branchName: string;
  pack: string | null;
  analog: boolean;
  current: { id: string; price: number; status: string; observedAt: string; source: string } | null;
};

const SOURCES = [
  { value: "admin_check", label: "Проверка в магазине" },
  { value: "price_tag_photo", label: "Фото ценника" },
  { value: "receipt", label: "Чек" },
  { value: "store_website", label: "Сайт магазина" },
] as const;

function todayAlmaty() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}

export function BranchPicker({ branches, branchId, q }: { branches: BranchOption[]; branchId: string; q: string }) {
  const router = useRouter();
  return (
    <form
      className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const params = new URLSearchParams();
        if (fd.get("branch")) params.set("branch", String(fd.get("branch")));
        if (String(fd.get("q") ?? "").trim()) params.set("q", String(fd.get("q")).trim());
        router.push(`/admin/prices?${params}`);
      }}
    >
      <NativeSelect name="branch" defaultValue={branchId} aria-label="Филиал">
        <option value="">Выберите филиал…</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.store_name} · {b.name}
          </option>
        ))}
      </NativeSelect>
      <Input name="q" defaultValue={q} placeholder="Фильтр по названию товара" aria-label="Фильтр товаров" />
      <Button type="submit" variant="secondary">Показать</Button>
    </form>
  );
}

export function PriceGrid({ rows, title, perProduct }: { rows: GridRow[]; title: string; perProduct: boolean }) {
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"verified" | "estimated">("verified");
  const [source, setSource] = useState<(typeof SOURCES)[number]["value"]>("admin_check");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayAlmaty());

  const changed = useMemo(
    () =>
      rows.filter((r) => {
        const v = values[r.key]?.replace(",", ".").trim();
        return v && Number(v) > 0 && Number(v) !== r.current?.price;
      }),
    [rows, values],
  );
  const invalid = rows.filter((r) => {
    const v = values[r.key]?.replace(",", ".").trim();
    return v && !(Number(v) > 0);
  });

  function save() {
    const observed = new Date(`${date}T12:00:00+05:00`);
    const observedIso = (observed > new Date() ? new Date() : observed).toISOString();
    const items: PriceItemInput[] = changed.map((r) => ({
      product_id: r.productId,
      branch_id: r.branchId,
      price: Number(values[r.key].replace(",", ".")),
      status,
      source_type: source,
      source_note: note.trim() || null,
      observed_at: observedIso,
    }));
    run(() => savePrices(items), () => setValues({}));
  }

  return (
    <section aria-label={title}>
      <div className="mb-3 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid grid-cols-1 gap-1">
          <Label htmlFor="g-status">Статус</Label>
          <NativeSelect id="g-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="verified">Подтверждена</option>
            <option value="estimated">Ориентировочная (нужен источник)</option>
          </NativeSelect>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <Label htmlFor="g-source">Источник</Label>
          <NativeSelect id="g-source" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <Label htmlFor="g-date">Дата наблюдения</Label>
          <Input id="g-date" type="date" value={date} max={todayAlmaty()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-1">
          <Label htmlFor="g-note">Примечание / источник</Label>
          <Input id="g-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Напр.: обход 12.10, ценники" />
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">{perProduct ? "Филиал" : "Товар"}</th>
              <th className="px-3 py-2.5">Текущая цена</th>
              <th className="w-40 px-3 py-2.5">Новая цена, ₸</th>
              <th className="w-12 px-3 py-2.5"><span className="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = values[r.key] ?? "";
              const isChanged = changed.includes(r);
              return (
                <tr key={r.key} className={isChanged ? "border-t border-border bg-primary-soft/40" : "border-t border-border"}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{perProduct ? r.branchName : r.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.pack ?? "фасовка не указана"}
                      {r.analog && " · аналоги, сверяйте фасовку"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {r.current ? (
                      <div>
                        <span className="font-semibold tabular-nums">{r.current.price.toLocaleString("ru-RU")} ₸</span>{" "}
                        <Badge tone={r.current.status === "verified" ? "primary" : "warning"}>
                          {r.current.status === "verified" ? "подтв." : "ориент."}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.current.observedAt).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" })} · {r.current.source}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Цена неизвестна</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      inputMode="decimal"
                      value={v}
                      onChange={(e) => setValues((s) => ({ ...s, [r.key]: e.target.value }))}
                      placeholder={r.current ? String(r.current.price) : "—"}
                      aria-label={`Новая цена: ${r.productName}, ${r.branchName}`}
                      aria-invalid={invalid.includes(r) || undefined}
                      className="h-10 tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {r.current && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Снять цену с публикации"
                        title="Снять цену с публикации"
                        disabled={pending}
                        onClick={() => {
                          const reason = prompt("Причина снятия цены (останется в журнале):", "Цена больше не действует");
                          if (reason) run(() => removePrice(r.current!.id, reason));
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-soft backdrop-blur">
        <p className="text-sm text-muted-foreground">
          Изменено: <b className="text-foreground">{changed.length}</b>
          {invalid.length > 0 && <span className="ml-2 text-danger">Некорректных: {invalid.length}</span>}
          {status === "estimated" && !note.trim() && <span className="ml-2 text-danger">Для ориентировочных цен заполните примечание</span>}
        </p>
        <Button onClick={save} disabled={pending || changed.length === 0 || invalid.length > 0 || (status === "estimated" && !note.trim())}>
          <Save aria-hidden /> Сохранить
        </Button>
      </div>
    </section>
  );
}
