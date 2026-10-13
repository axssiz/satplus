"use client";

import { BellRing, Check, Flag, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { recordView, reportError, requestPrice } from "@/app/actions/public";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label, NativeSelect, Textarea } from "@/components/ui/input";
import { useLocalStore } from "@/lib/client/local-store";
import { REPORT_REASONS } from "@/lib/validation";

export function ReportDialog({ targetType, targetId }: { targetType: "product" | "verified_price" | "store_branch"; targetId: string }) {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground">
          <Flag aria-hidden /> {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent side="bottom" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await reportError(fd);
              if (res.ok) {
                toast.success(t("success"));
                setOpen(false);
              } else toast.error(t("error"));
            });
          }}
        >
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">{t("reason")}</Label>
            <NativeSelect id="report-reason" name="reason" defaultValue="wrong_price" required>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reasons.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-message">{t("message")}</Label>
            <Textarea id="report-message" name="message" maxLength={1000} placeholder={t("messagePlaceholder")} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} {t("submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY: string[] = [];

export function WantPriceButton({ productId, slug, initialCount }: { productId: string; slug: string; initialCount: number }) {
  const t = useTranslations("product");
  const [voted, setVoted] = useLocalStore<string[]>("satplus:requested:v1", EMPTY);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  const already = Array.isArray(voted) && voted.includes(productId);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={already ? "secondary" : "outline"}
        disabled={pending || already}
        onClick={() =>
          start(async () => {
            const res = await requestPrice(productId, slug);
            if (res.ok) {
              setVoted((prev) => [...(Array.isArray(prev) ? prev : []), productId].slice(-300));
              if (res.data) setCount(res.data.count);
              toast.success(t("wantPriceThanks"));
            } else toast.error(t("wantPrice"));
          })
        }
      >
        {already ? <Check aria-hidden /> : <BellRing aria-hidden />}
        {already ? t("wantPriceVoted") : t("wantPrice")}
      </Button>
      <span className="text-sm text-muted-foreground">{t("wantPriceCount", { count })}</span>
    </div>
  );
}

export function ViewBeacon({ productId }: { productId: string }) {
  useEffect(() => {
    const key = `satplus:viewed:${productId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore
    }
    void recordView(productId);
  }, [productId]);
  return null;
}
