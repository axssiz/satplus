"use client";

import Papa from "papaparse";
import { CheckCircle2, Download, FileUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importPricesCsv, type CsvPriceRow } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

const COLUMNS = ["product", "branch", "price", "status", "observed_at", "source_type", "source_note", "source_url", "pack_quantity", "pack_unit", "brand_label"];
const TEMPLATE = `${COLUMNS.join(",")}\nhleb-belyy,akcent-satpaev-1,,verified,${new Date().toISOString().slice(0, 10)},admin_check,"Обход магазина",,,,\n`;

type Check = { valid: number; errors: { row: number; message: string }[] };

export function CsvImport({ branchSlugs }: { branchSlugs: { slug: string; label: string }[] }) {
  const [rows, setRows] = useState<CsvPriceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [pending, start] = useTransition();

  function onFile(file: File) {
    setCheck(null);
    setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) return toast.error("Файл больше 2 МБ — разбейте его на части");
    Papa.parse<CsvPriceRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const missing = ["product", "branch", "price"].filter((c) => !res.meta.fields?.includes(c));
        if (missing.length) {
          setRows([]);
          return toast.error(`Нет обязательных колонок: ${missing.join(", ")}`);
        }
        setRows(res.data);
        validate(res.data);
      },
      error: () => toast.error("Не удалось прочитать файл"),
    });
  }

  function validate(data: CsvPriceRow[]) {
    start(async () => {
      const r = await importPricesCsv(data, false);
      if (r.ok && r.data) setCheck(r.data);
      else if (!r.ok) toast.error(r.error);
    });
  }

  function apply() {
    start(async () => {
      const r = await importPricesCsv(rows, true);
      if (!r.ok) return void toast.error(r.error);
      if (r.data?.errors.length) {
        setCheck(r.data);
        return void toast.error(r.message ?? "Есть ошибки");
      }
      toast.success(r.message ?? "Импортировано");
      setRows([]);
      setCheck(null);
      setFileName("");
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid grid-cols-1 content-start gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center hover:border-primary">
          <FileUp className="size-8 text-primary" aria-hidden />
          <span className="font-semibold">{fileName || "Выберите CSV-файл"}</span>
          <span className="text-xs text-muted-foreground">до 2000 строк, кодировка UTF-8, разделитель — запятая</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>

        {pending && <p className="text-sm text-muted-foreground" role="status">Проверяем…</p>}

        {check && (
          <div className="rounded-2xl border border-border bg-card p-4" role="status">
            <p className="flex items-center gap-2 font-semibold">
              {check.errors.length === 0 ? <CheckCircle2 className="size-5 text-primary" aria-hidden /> : null}
              Строк: {rows.length} · корректных: {check.valid} · с ошибками: {check.errors.length}
            </p>
            {check.errors.length > 0 && (
              <ul className="mt-3 max-h-80 space-y-1 overflow-auto text-sm">
                {check.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`} className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-danger">
                    Строка {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={apply} disabled={pending || check.errors.length > 0 || check.valid === 0}>
                Записать {check.valid} цен
              </Button>
              <Button variant="outline" onClick={() => validate(rows)} disabled={pending}>
                Проверить снова
              </Button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="relative overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-surface text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">#</th>
                  {COLUMNS.slice(0, 7).map((c) => (
                    <th key={c} className="px-2 py-2">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5 text-muted-foreground">{i + 2}</td>
                    {COLUMNS.slice(0, 7).map((c) => (
                      <td key={c} className="max-w-48 truncate px-2 py-1.5">{r[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p className="p-2 text-xs text-muted-foreground">Показаны первые 50 строк из {rows.length}.</p>}
          </div>
        )}
      </div>

      <aside className="grid grid-cols-1 content-start gap-3 text-sm">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold">Формат</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            <li><b>product</b> — слаг товара или штрихкод</li>
            <li><b>branch</b> — слаг филиала</li>
            <li><b>price</b> — цена в тенге, больше 0</li>
            <li><b>status</b> — verified или estimated (для estimated обязателен source_note или source_url)</li>
            <li><b>observed_at</b> — ГГГГ-ММ-ДД, не в будущем</li>
            <li><b>source_type</b> — admin_check, store_website, price_tag_photo, receipt, import</li>
            <li>pack_quantity + pack_unit (g, kg, ml, l, pcs) — фактическая фасовка</li>
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "qaiarzan-template.csv";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Download aria-hidden /> Шаблон CSV
          </Button>
        </div>
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Слаги филиалов ({branchSlugs.length})</summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs">
            {branchSlugs.map((b) => (
              <li key={b.slug}>
                <code className="rounded bg-surface-2 px-1">{b.slug}</code> — {b.label}
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </div>
  );
}
