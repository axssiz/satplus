"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reportPromotion } from "@/app/actions/promotions";
import { PhotoRedactor } from "@/components/prices/photo-redactor";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const FIELD_ERRORS = ["titleLength", "store", "date", "url", "consent"] as const;

export function PromotionReportForm({ stores, defaultStore }: { stores: { slug: string; name: string }[]; defaultStore?: string }) {
  const t = useTranslations("promotionReport");
  const tP = useTranslations("promotions");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<{ blob: Blob; redacted: boolean } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [store, setStore] = useState(defaultStore ?? "");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const err = (k: string) => {
    const code = errors[k];
    if (!code) return undefined;
    return (FIELD_ERRORS as readonly string[]).includes(code) ? t(`errors.${code}` as "errors.url") : t("errors.validation");
  };

  if (done) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <CheckCircle2 className="size-12 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">{t("success")}</h2>
        <p className="text-sm text-muted-foreground">{t("successHint")}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/promotions" className={buttonVariants({ variant: "outline" })}>
            {tP("back")}
          </Link>
          <Button
            onClick={() => {
              setDone(false);
              setPhoto(null);
              setStore("");
              setFormKey((k) => k + 1);
            }}
          >
            {t("sendAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      key={formKey}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const local: Record<string, string> = {};
        const title = String(fd.get("title") ?? "").trim();
        const url = String(fd.get("sourceUrl") ?? "").trim();
        if (!store || (store === "other" && !String(fd.get("storeText") ?? "").trim())) local.store = "store";
        if (title.length < 5 || title.length > 160) local.title = "titleLength";
        if (url && !/^https:\/\//i.test(url)) local.sourceUrl = "url";
        if (!fd.get("consent")) local.consent = "consent";
        setErrors(local);
        if (Object.keys(local).length) {
          toast.error(t("errors.validation"));
          return;
        }
        if (photo) fd.set("photo", new File([photo.blob], "photo.jpg", { type: "image/jpeg" }));
        start(async () => {
          const res = await reportPromotion(fd);
          if (res.ok) {
            setDone(true);
            toast.success(t("success"), { description: t("successHint") });
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(t(`errors.${res.error}` as "errors.server"));
          }
        });
      }}
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="store">{t("store")}</Label>
          <NativeSelect id="store" name="store" value={store} onChange={(e) => setStore(e.target.value)} aria-invalid={!!errors.store}>
            <option value="" disabled>
              {t("storeChoose")}
            </option>
            {stores.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
            <option value="other">{t("storeOther")}</option>
          </NativeSelect>
          <FieldError>{err("store")}</FieldError>
        </div>
        {store === "other" && (
          <div className="space-y-1.5">
            <Label htmlFor="storeText">{t("storeText")}</Label>
            <Input id="storeText" name="storeText" maxLength={120} />
            <FieldHint>{t("storeTextHint")}</FieldHint>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("titleField")}</Label>
        <Input id="title" name="title" maxLength={160} placeholder={t("titlePlaceholder")} aria-invalid={!!errors.title} />
        <FieldError>{err("title")}</FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="details">{t("details")}</Label>
        <Textarea id="details" name="details" rows={4} maxLength={2000} placeholder={t("detailsPlaceholder")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="endsOn">{t("endsOn")}</Label>
          <Input id="endsOn" name="endsOn" type="date" aria-invalid={!!errors.endsOn} />
          <FieldHint>{t("endsOnHint")}</FieldHint>
          <FieldError>{err("endsOn")}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sourceUrl">{t("sourceUrl")}</Label>
          <Input id="sourceUrl" name="sourceUrl" type="url" inputMode="url" maxLength={500} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
          <FieldHint>{t("sourceUrlHint")}</FieldHint>
          <FieldError>{err("sourceUrl")}</FieldError>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact">{t("contact")}</Label>
        <Input id="contact" name="contact" maxLength={120} autoComplete="email" />
        <FieldHint>{t("contactHint")}</FieldHint>
      </div>

      <PhotoRedactor onBusy={setPhotoBusy} namespace="promotionReport" onChange={setPhoto} onError={(m) => toast.error(m)} />

      <label className={cn("flex items-start gap-3 text-sm", errors.consent && "text-danger")}>
        <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>
          {t("consent")}{" "}
          <Link href="/terms" className="underline" target="_blank">
            ↗
          </Link>
        </span>
      </label>
      <FieldError>{err("consent")}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={pending || photoBusy}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
