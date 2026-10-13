"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveServiceListing } from "@/app/actions/services";
import { PhotoRedactor } from "@/components/prices/photo-redactor";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type ServiceListingFormValues = {
  id: string | null;
  categoryId: string;
  title: string;
  providerName: string;
  description: string;
  priceNote: string;
  area: string;
  phone: string;
  hasWhatsapp: boolean;
  linkUrl: string;
  coverUrl: string | null;
};

const FIELD_ERRORS = ["category", "title", "providerName", "description", "phone", "url", "consent"] as const;
const PHONE = /^\+?[0-9 ()-]{6,24}$/;

/** Create (values.id = null) or edit the signed-in provider's own listing. Both go to moderation. */
export function ServiceListingForm({ values: v, categories }: { values: ServiceListingFormValues; categories: { id: string; name: string }[] }) {
  const t = useTranslations("serviceForm");
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<{ blob: Blob; redacted: boolean } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

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
        <Link href="/services/my" className={buttonVariants()}>
          {t("toMy")}
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const s = (k: string) => String(fd.get(k) ?? "").trim();
        const local: Record<string, string> = {};
        if (!s("categoryId")) local.categoryId = "category";
        if (s("title").length < 5 || s("title").length > 120) local.title = "title";
        if (s("providerName").length < 2 || s("providerName").length > 80) local.providerName = "providerName";
        if (s("description").length < 20 || s("description").length > 3000) local.description = "description";
        if (!PHONE.test(s("phone"))) local.phone = "phone";
        if (s("linkUrl") && !/^https:\/\//i.test(s("linkUrl"))) local.linkUrl = "url";
        if (!fd.get("consent")) local.consent = "consent";
        setErrors(local);
        if (Object.keys(local).length) {
          toast.error(t("errors.validation"));
          return;
        }
        if (photo) fd.set("photo", new File([photo.blob], "photo.jpg", { type: "image/jpeg" }));
        start(async () => {
          const res = await saveServiceListing(fd);
          if (res.ok) {
            if (v.id) {
              toast.success(t("success"));
              router.push("/services/my");
            } else {
              setDone(true);
              toast.success(t("success"), { description: t("successHint") });
            }
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(t(`errors.${res.error}` as "errors.server"));
          }
        });
      }}
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">{t("category")}</Label>
          <NativeSelect id="categoryId" name="categoryId" defaultValue={v.categoryId} aria-invalid={!!errors.categoryId}>
            <option value="" disabled>
              {t("categoryChoose")}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError>{err("categoryId")}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="providerName">{t("providerName")}</Label>
          <Input id="providerName" name="providerName" maxLength={80} defaultValue={v.providerName} aria-invalid={!!errors.providerName} />
          <FieldHint>{t("providerNameHint")}</FieldHint>
          <FieldError>{err("providerName")}</FieldError>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("title")}</Label>
        <Input id="title" name="title" maxLength={120} placeholder={t("titlePlaceholder")} defaultValue={v.title} aria-invalid={!!errors.title} />
        <FieldError>{err("title")}</FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          maxLength={3000}
          placeholder={t("descriptionPlaceholder")}
          defaultValue={v.description}
          aria-invalid={!!errors.description}
        />
        <FieldError>{err("description")}</FieldError>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="priceNote">{t("priceNote")}</Label>
          <Input id="priceNote" name="priceNote" maxLength={120} placeholder={t("priceNotePlaceholder")} defaultValue={v.priceNote} />
          <FieldHint>{t("priceNoteHint")}</FieldHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="area">{t("area")}</Label>
          <Input id="area" name="area" maxLength={120} placeholder={t("areaPlaceholder")} defaultValue={v.area} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" maxLength={24} autoComplete="tel" defaultValue={v.phone} aria-invalid={!!errors.phone} />
          <FieldHint>{t("phoneHint")}</FieldHint>
          <FieldError>{err("phone")}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="linkUrl">{t("linkUrl")}</Label>
          <Input id="linkUrl" name="linkUrl" type="url" inputMode="url" maxLength={500} placeholder="https://" defaultValue={v.linkUrl} aria-invalid={!!errors.linkUrl} />
          <FieldHint>{t("linkUrlHint")}</FieldHint>
          <FieldError>{err("linkUrl")}</FieldError>
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="hasWhatsapp" defaultChecked={v.hasWhatsapp} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>{t("hasWhatsapp")}</span>
      </label>

      {v.coverUrl && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("currentPhoto")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- owner preview */}
          <img src={v.coverUrl} alt="" className="max-h-48 rounded-xl border border-border" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="removeCover" className="size-4 accent-[var(--primary)]" />
            {t("removeCurrentPhoto")}
          </label>
        </div>
      )}
      <PhotoRedactor onBusy={setPhotoBusy} namespace="serviceForm" onChange={setPhoto} onError={(m) => toast.error(m)} />

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
        {pending ? t("submitting") : v.id ? t("save") : t("submit")}
      </Button>
    </form>
  );
}
