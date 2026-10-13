"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkProducts } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminAction } from "../_components/forms";
import { Empty } from "../_components/ui";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  hasKk: boolean;
  category: string;
  brand: string | null;
  pack: string;
  analog: boolean;
  active: boolean;
  specsVerified: boolean;
  barcodes: string[];
  prices: number;
};

export function ProductTable({ rows }: { rows: ProductRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, run } = useAdminAction();
  if (rows.length === 0) return <Empty>Товары не найдены.</Empty>;
  const all = selected.size === rows.length;
  const ids = [...selected];

  function bulk(action: "activate" | "deactivate" | "delete") {
    if (action === "delete" && !confirm(`Удалить ${ids.length} товар(ов)? Это нельзя отменить. Товары с заявками удалить нельзя — их можно скрыть.`)) return;
    run(() => bulkProducts(ids, action), () => setSelected(new Set()));
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Выбрано: {selected.size} из {rows.length}</span>
        <Button size="sm" variant="outline" disabled={pending || !ids.length} onClick={() => bulk("activate")}>Показать</Button>
        <Button size="sm" variant="outline" disabled={pending || !ids.length} onClick={() => bulk("deactivate")}>Скрыть</Button>
        <Button size="sm" variant="danger" disabled={pending || !ids.length} onClick={() => bulk("delete")}>Удалить</Button>
      </div>
      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" aria-label="Выбрать все" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4" />
              </th>
              <th className="px-3 py-2.5">Товар</th>
              <th className="px-3 py-2.5">Категория</th>
              <th className="px-3 py-2.5">Фасовка</th>
              <th className="px-3 py-2.5">Штрихкоды</th>
              <th className="px-3 py-2.5">Цен</th>
              <th className="px-3 py-2.5">Состояние</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    aria-label={`Выбрать ${r.name}`}
                    checked={selected.has(r.id)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/products/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                  <p className="text-xs text-muted-foreground">
                    {r.brand ?? "без бренда"} · <code>{r.slug}</code>
                  </p>
                </td>
                <td className="px-3 py-2">{r.category}</td>
                <td className="px-3 py-2">{r.pack}{r.analog && <span className="block text-xs text-muted-foreground">аналоги</span>}</td>
                <td className="px-3 py-2 text-xs">{r.barcodes.join(", ") || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.prices}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.active ? <Badge tone="primary">активен</Badge> : <Badge>скрыт</Badge>}
                    {!r.specsVerified && <Badge tone="warning">не проверен</Badge>}
                    {!r.hasKk && <Badge tone="outline">нет KZ</Badge>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
