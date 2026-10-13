"use client";

import { CheckCircle2, Info, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { suggestNews } from "@/app/actions/news";
import { PhotoRedactor } from "@/components/prices/photo-redactor";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const FIELD_ERRORS = ["titleLength", "bodyLength", "url", "consent"] as const;

export function NewsSuggestForm({ categories }: { categories: { id: string; name: string }[] }) {
  const t = useTranslations("newsSuggest");
  const tNews = useTranslations("news");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<{ blob: Blob; redacted: boolean } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
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
          <Link href="/news" className={buttonVariants({ variant: "outline" })}>
            {tNews("back")}
          </Link>
          <Button
            onClick={() => {
              setDone(false);
              setPhoto(null);
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
        const body = String(fd.get("body") ?? "").trim();
        const url = String(fd.get("sourceUrl") ?? "").trim();
        if (title.length < 5 || title.length > 200) local.title = "titleLength";
        if (body.length < 20 || body.length > 5000) local.body = "bodyLength";
        if (url && !/^https:\/\//i.test(url)) local.sourceUrl = "url";
        if (!fd.get("consent")) local.consent = "consent";
        setErrors(local);
        if (Object.keys(local).length) {
          toast.error(t("errors.validation"));
          return;
        }
        if (photo) fd.set("photo", new File([photo.blob], "photo.jpg", { type: "image/jpeg" }));
        start(async () => {
          const res = await suggestNews(fd);
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

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("titleField")}</Label>
        <Input id="title" name="title" maxLength={200} placeholder={t("titlePlaceholder")} aria-invalid={!!errors.title} aria-describedby="title-error" />
        <FieldError id="title-error">{err("title")}</FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">{t("body")}</Label>
        <Textarea id="body" name="body" rows={6} maxLength={5000} placeholder={t("bodyPlaceholder")} aria-invalid={!!errors.body} aria-describedby="body-error" />
        <FieldError id="body-error">{err("body")}</FieldError>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="space-y-1.5">
          <Label htmlFor="sourceUrl">{t("sourceUrl")}</Label>
          <Input id="sourceUrl" name="sourceUrl" type="url" inputMode="url" maxLength={500} placeholder="https://" aria-invalid={!!errors.sourceUrl} aria-describedby="url-hint" />
          <FieldHint>
            <span id="url-hint">{t("sourceUrlHint")}</span>
          </FieldHint>
          <FieldError>{err("sourceUrl")}</FieldError>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact">{t("contact")}</Label>
        <Input id="contact" name="contact" maxLength={120} autoComplete="email" />
        <FieldHint>{t("contactHint")}</FieldHint>
      </div>

      <PhotoRedactor onBusy={setPhotoBusy} namespace="newsSuggest" onChange={setPhoto} onError={(m) => toast.error(m)} />

      <p className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-xs text-warning-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("notOfficial")}
      </p>

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
