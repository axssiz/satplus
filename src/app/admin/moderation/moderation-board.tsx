"use client";

import { AlertTriangle, Check, ExternalLink, ImageIcon, X } from "lucide-react";
import { useState } from "react";
import { approveSubmission, rejectSubmission, removePrice, resolveReport } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAction } from "../_components/forms";
import { Empty } from "../_components/ui";

export type QueueSubmission = {
  id: string;
  kind: "new" | "confirm";
  price: number;
  pack: string | null;
  brandLabel: string | null;
  observedAt: string;
  createdAt: string;
  comment: string | null;
  author: string;
  referencePrice: number | null;
  isAnomalous: boolean;
  anomalyReason: string | null;
  product: { slug: string; name: string; analog: boolean } | null;
  branch: string;
  evidence: { url: string; kind: string; redacted: boolean }[];
};

export type QueueReport = {
  id: string;
  targetType: "product" | "verified_price" | "store_branch";
  targetId: string;
  targetLabel: string;
  targetExists: boolean;
  reason: string;
  message: string | null;
  createdAt: string;
};

const REASONS: Record<string, string> = {
  wrong_price: "Неверная цена",
  wrong_info: "Неверные данные",
  duplicate: "Дубликат",
  outdated: "Устарело",
  other: "Другое",
};
const EVIDENCE: Record<string, string> = { price_tag: "Ценник", receipt: "Чек", shelf: "Полка" };

const dt = (iso: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" }).format(new Date(iso));

function SubmissionCard({ s }: { s: QueueSubmission }) {
  const { pending, run } = useAdminAction();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const diff = s.referencePrice ? Math.round(((s.price - s.referencePrice) / s.referencePrice) * 100) : null;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft" aria-label={`Заявка: ${s.product?.name ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {s.product ? (
              <a href={`/prices/p/${s.product.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {s.product.name} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : (
              "Товар удалён"
            )}
          </p>
          <p className="text-sm text-muted-foreground">{s.branch}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold tabular-nums">{s.price.toLocaleString("ru-RU")} ₸</p>
          {s.referencePrice != null && (
            <p className="text-xs text-muted-foreground">
              медиана {s.referencePrice.toLocaleString("ru-RU")} ₸{diff != null && ` (${diff > 0 ? "+" : ""}${diff}%)`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={s.kind === "confirm" ? "info" : "neutral"}>{s.kind === "confirm" ? "Подтверждение" : "Новая цена"}</Badge>
        {s.isAnomalous && (
          <Badge tone="danger">
            <AlertTriangle aria-hidden /> Подозрительно{s.anomalyReason ? `: ${s.anomalyReason}` : ""}
          </Badge>
        )}
        {s.pack && <Badge tone="outline">Фасовка {s.pack}</Badge>}
        {s.brandLabel && <Badge tone="outline">{s.brandLabel}</Badge>}
        {s.product?.analog && !s.pack && <Badge tone="warning">Аналог без фасовки</Badge>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
        <div><dt className="inline">Наблюдение: </dt><dd className="inline text-foreground">{dt(s.observedAt)}</dd></div>
        <div><dt className="inline">Отправлено: </dt><dd className="inline text-foreground">{dt(s.createdAt)}</dd></div>
        <div><dt className="inline">Автор: </dt><dd className="inline text-foreground">{s.author}</dd></div>
      </dl>
      {s.comment && <p className="mt-2 rounded-xl bg-surface p-2.5 text-sm">{s.comment}</p>}

      {s.evidence.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.evidence.map((e) => (
            <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
              <img src={e.url} alt={`Фото: ${EVIDENCE[e.kind] ?? e.kind}`} className="h-28 w-28 object-cover transition group-hover:opacity-90" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                {EVIDENCE[e.kind] ?? e.kind}
                {e.redacted ? " · скрыто" : ""}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" aria-hidden /> Без фото
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Источник / примечание (для ориентировочной обязательно)" maxLength={300} className="h-10 text-sm" aria-label="Примечание к одобрению" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(() => approveSubmission(s.id, "verified", note))}>
              <Check aria-hidden /> Подтвердить
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || note.trim().length < 3}
              title={note.trim().length < 3 ? "Укажите источник в примечании" : undefined}
              onClick={() => run(() => approveSubmission(s.id, "estimated", note))}
            >
              Как ориентировочную
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина отклонения" maxLength={300} className="h-10 text-sm" aria-label="Причина отклонения" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger" disabled={pending || reason.trim().length < 2} onClick={() => run(() => rejectSubmission(s.id, reason))}>
              <X aria-hidden /> Отклонить
            </Button>
            {["Не читается фото", "Цена не совпадает с фото", "Дубликат"].map((r) => (
              <Button key={r} size="sm" variant="ghost" type="button" onClick={() => setReason(r)} className="text-xs">
                {r}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function ReportCard({ r }: { r: QueueReport }) {
  const { pending, run } = useAdminAction();
  const [note, setNote] = useState("");
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">{REASONS[r.reason] ?? r.reason}</Badge>
        <span className="text-xs text-muted-foreground">{dt(r.createdAt)}</span>
      </div>
      <p className="mt-2 font-medium">{r.targetLabel}</p>
      {r.message && <p className="mt-1 rounded-xl bg-surface p-2.5 text-sm">{r.message}</p>}
      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий модератора" maxLength={300} className="h-10 text-sm" aria-label="Комментарий модератора" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => resolveReport(r.id, "resolve", note))}>
            Исправлено
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveReport(r.id, "dismiss", note))}>
            Отклонить жалобу
          </Button>
          {r.targetType === "verified_price" && r.targetExists && (
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (!confirm("Снять эту цену с публикации? Она останется в истории.")) return;
                run(async () => {
                  const res = await removePrice(r.targetId, note || "Жалоба пользователя");
                  if (res.ok) await resolveReport(r.id, "resolve", note || "Цена снята");
                  return res;
                });
              }}
            >
              Снять цену
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ModerationBoard({ submissions, reports }: { submissions: QueueSubmission[]; reports: QueueReport[] }) {
  return (
    <Tabs defaultValue="subs">
      <TabsList>
        <TabsTrigger value="subs">Цены ({submissions.length})</TabsTrigger>
        <TabsTrigger value="reports">Жалобы ({reports.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="subs" className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
        {submissions.length === 0 ? <Empty>Очередь пуста — все заявки обработаны.</Empty> : submissions.map((s) => <SubmissionCard key={s.id} s={s} />)}
      </TabsContent>
      <TabsContent value="reports" className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
        {reports.length === 0 ? <Empty>Открытых жалоб нет.</Empty> : reports.map((r) => <ReportCard key={r.id} r={r} />)}
      </TabsContent>
    </Tabs>
  );
}
