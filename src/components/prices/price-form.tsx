"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitPrice, type ActionError } from "@/app/actions/public";
import type { ProductLite } from "@/app/api/products/search/route";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { almatyDate, PACK_UNITS } from "@/lib/validation";
import { unitLabel, type AppLocale } from "@/lib/format";
import type { PackUnit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PhotoRedactor } from "./photo-redactor";
import { ProductPicker } from "./product-picker";

export type BranchOption = { id: string; slug: string; label: string; isDemo: boolean };

const ERROR_KEYS: Record<ActionError, string> = {
  validation: "validation",
  rateLimited: "rateLimited",
  duplicate: "duplicate",
  photoTooLarge: "photoTooLarge",
  photoType: "photoType",
  notFound: "notFound",
  server: "server",
};

function dateBounds() {
  const now = Date.now();
  return { today: almatyDate(new Date(now)), minDate: almatyDate(new Date(now - 30 * 86_400_000)) };
}

export function PriceForm({
  initialProduct,
  branches,
  initialBranchId,
  signedIn,
}: {
  initialProduct: ProductLite | null;
  branches: BranchOption[];
  initialBranchId?: string;
  signedIn: boolean;
}) {
  const t = useTranslations("addPrice");
  const locale = useLocale() as AppLocale;
  const [product, setProduct] = useState<ProductLite | null>(initialProduct);
  const [photo, setPhoto] = useState<{ blob: Blob; redacted: boolean } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [{ today, minDate }] = useState(() => dateBounds());
  const needsPack = !!product && product.comparisonMode === "analog" && !product.isWeighted;
  const err = (k: string) => {
    const code = errors[k];
    if (!code) return undefined;
    const known = ["required", "consent", "priceRange", "dateRange", "packRequired"];
    if (code === "packRequired") return t("packRequired");
    return known.includes(code) ? t(`errors.${code}` as "errors.required") : t("errors.validation");
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <CheckCircle2 className="size-12 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">{t("success")}</h2>
        <p className="text-sm text-muted-foreground">{t("successHint")}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {product && (
            <Link href={`/prices/p/${product.slug}`} className={buttonVariants({ variant: "outline" })}>
              {locale === "kk" && product.nameKk ? product.nameKk : product.nameRu}
            </Link>
          )}
          <Button
            onClick={() => {
              setDone(false);
              setPhoto(null);
            }}
          >
            {t("title")}
          </Button>
        </div>
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
        const local: Record<string, string> = {};
        if (!product) local.productId = "required";
        if (!fd.get("branchId")) local.branchId = "required";
        const price = Number(String(fd.get("price") ?? "").replace(",", "."));
        if (!(price >= 1 && price <= 1_000_000)) local.price = "priceRange";
        if (needsPack && (!fd.get("packQuantity") || !fd.get("packUnit"))) local.packQuantity = "packRequired";
        if (!fd.get("consent")) local.consent = "consent";
        setErrors(local);
        if (Object.keys(local).length) {
          toast.error(t("errors.validation"));
          return;
        }
        fd.set("price", String(price));
        if (product) fd.set("productId", product.id);
        if (photo) {
          fd.set("photo", new File([photo.blob], "photo.jpg", { type: "image/jpeg" }));
          fd.set("photoRedacted", photo.redacted ? "1" : "0");
        } else fd.delete("photoKind");
        start(async () => {
          const res = await submitPrice(fd);
          if (res.ok) {
            setDone(true);
            toast.success(t("success"), { description: t("successHint") });
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(t(`errors.${ERROR_KEYS[res.error]}` as "errors.server"));
          }
        });
      }}
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="space-y-1.5">
        <Label>{t("product")}</Label>
        {product ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary-soft/40 px-3.5 py-2.5">
            <span className="min-w-0 truncate text-sm font-semibold">
              {locale === "kk" && product.nameKk ? product.nameKk : product.nameRu}
              {product.brandName && <span className="font-normal text-muted-foreground"> · {product.brandName}</span>}
            </span>
            <button type="button" onClick={() => setProduct(null)} className="grid size-8 place-items-center rounded-lg hover:bg-card" aria-label="×">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <ProductPicker placeholder={t("productPlaceholder")} onPick={setProduct} />
        )}
        <FieldError>{err("productId")}</FieldError>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="branchId">{t("store")}</Label>
        <NativeSelect id="branchId" name="branchId" defaultValue={initialBranchId ?? ""} aria-invalid={!!errors.branchId}>
          <option value="" disabled>
            {t("storePlaceholder")}
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
              {b.isDemo ? " · DEMO" : ""}
            </option>
          ))}
        </NativeSelect>
        <FieldError>{err("branchId")}</FieldError>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{t("kind")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["new", "confirm"] as const).map((k) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40"
            >
              <input type="radio" name="kind" value={k} defaultChecked={k === "new"} className="accent-[var(--primary)]" />
              {k === "new" ? t("kindNew") : t("kindConfirm")}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="price">{t("price")}</Label>
          <Input id="price" name="price" inputMode="decimal" autoComplete="off" placeholder="0" aria-invalid={!!errors.price} className="tabular text-lg font-semibold" />
          <FieldError>{err("price")}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="observedDate">{t("observedAt")}</Label>
          <Input id="observedDate" name="observedDate" type="date" defaultValue={today} min={minDate} max={today} aria-invalid={!!errors.observedDate} />
          <FieldError>{err("observedDate")}</FieldError>
        </div>
      </div>

      {needsPack && (
        <fieldset className="space-y-2 rounded-2xl bg-surface p-4">
          <legend className="sr-only">{t("pack")}</legend>
          <p className="text-sm font-medium">{t("pack")}</p>
          <FieldHint>{t("packRequired")}</FieldHint>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <Input name="packQuantity" inputMode="decimal" placeholder={t("packQuantity")} aria-label={t("packQuantity")} aria-invalid={!!errors.packQuantity} />
            <NativeSelect name="packUnit" aria-label={t("packUnit")} defaultValue={product!.unit === "kg" ? "g" : product!.unit === "l" ? "ml" : "pcs"}>
              {PACK_UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u as PackUnit, locale)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <FieldError>{err("packQuantity") ?? err("packUnit")}</FieldError>
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="brandLabel">{t("brandLabel")}</Label>
            <Input id="brandLabel" name="brandLabel" maxLength={80} />
            <FieldHint>{t("brandLabelHint")}</FieldHint>
          </div>
        </fieldset>
      )}

      <div className="space-y-2">
        <PhotoRedactor onBusy={setPhotoBusy} onChange={setPhoto} onError={(m) => toast.error(m)} />
        {photo && (
          <div className="space-y-1.5">
            <Label htmlFor="photoKind">{t("photoKind")}</Label>
            <NativeSelect id="photoKind" name="photoKind" defaultValue="price_tag">
              <option value="price_tag">{t("photoPriceTag")}</option>
              <option value="receipt">{t("photoReceipt")}</option>
              <option value="shelf">{t("photoShelf")}</option>
            </NativeSelect>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="comment">{t("comment")}</Label>
        <Textarea id="comment" name="comment" maxLength={500} placeholder={t("commentPlaceholder")} />
      </div>

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

      {!signedIn && <p className="rounded-xl bg-surface p-3 text-xs text-muted-foreground">{t("anonymousNote")}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending || photoBusy}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
