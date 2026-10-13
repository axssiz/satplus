"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { suggestBusiness } from "@/app/actions/businesses";
import { PhotoRedactor } from "@/components/prices/photo-redactor";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const FIELD_ERRORS = ["name", "details", "url", "consent"] as const;

/** `correction` set: the reader reports an error in that organisation's card. */
export function BusinessSuggestForm({
  categories,
  correction,
}: {
  categories: { id: string; name: string }[];
  correction?: { slug: string; name: string };
}) {
  const t = useTranslations("businessSuggest");
  const tB = useTranslations("businesses");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<{ blob: Blob; redacted: boolean } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const kind = correction ? "correction" : "new";

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
          <Link href={correction ? `/businesses/${correction.slug}` : "/businesses"} className={buttonVariants({ variant: "outline" })}>
            {correction ? correction.name : tB("back")}
          </Link>
          {!correction && (
            <Button
              onClick={() => {
                setDone(false);
                setPhoto(null);
                setFormKey((k) => k + 1);
              }}
            >
              {t("sendAnother")}
            </Button>
          )}
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
        const name = String(fd.get("name") ?? "").trim();
        const details = String(fd.get("details") ?? "").trim();
        const url = String(fd.get("website") ?? "").trim();
        if (kind === "new" && (name.length < 2 || name.length > 120)) local.name = "name";
        if (kind === "correction" && details.length < 5) local.details = "details";
        if (url && !/^https:\/\//i.test(url)) local.website = "url";
        if (!fd.get("consent")) local.consent = "consent";
        setErrors(local);
        if (Object.keys(local).length) {
          toast.error(t("errors.validation"));
          return;
        }
        if (photo) fd.set("photo", new File([photo.blob], "photo.jpg", { type: "image/jpeg" }));
        start(async () => {
          const res = await suggestBusiness(fd);
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
      <input type="hidden" name="kind" value={kind} />
      {correction && <input type="hidden" name="businessSlug" value={correction.slug} />}
      <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {correction ? (
        <div className="space-y-1.5">
          <Label htmlFor="details">{t("detailsCorrection")}</Label>
          <Textarea id="details" name="details" rows={5} maxLength={2000} placeholder={t("detailsCorrectionPlaceholder")} aria-invalid={!!errors.details} />
          <FieldError>{err("details")}</FieldError>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" name="name" maxLength={120} aria-invalid={!!errors.name} />
              <FieldError>{err("name")}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">{t("category")}</Label>
              <NativeSelect id="categoryId" name="categoryId" defaultValue="">
                <option value="">{t("categoryNone")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">{t("address")}</Label>
            <Input id="address" name="address" maxLength={200} />
            <FieldHint>{t("addressHint")}</FieldHint>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="openingHours">{t("hours")}</Label>
          <Input id="openingHours" name="openingHours" maxLength={300} placeholder={t("hoursPlaceholder")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="website">{t("website")}</Label>
          <Input id="website" name="website" type="url" inputMode="url" maxLength={500} placeholder="https://" aria-invalid={!!errors.website} />
          <FieldHint>{t("websiteHint")}</FieldHint>
          <FieldError>{err("website")}</FieldError>
        </div>
      </div>

      {!correction && (
        <div className="space-y-1.5">
          <Label htmlFor="details">{t("details")}</Label>
          <Textarea id="details" name="details" rows={3} maxLength={2000} placeholder={t("detailsPlaceholder")} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="contact">{t("contact")}</Label>
        <Input id="contact" name="contact" maxLength={120} autoComplete="email" />
        <FieldHint>{t("contactHint")}</FieldHint>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="isOwner" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>{t("isOwner")}</span>
      </label>

      <PhotoRedactor onBusy={setPhotoBusy} namespace="businessSuggest" onChange={setPhoto} onError={(m) => toast.error(m)} />

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
