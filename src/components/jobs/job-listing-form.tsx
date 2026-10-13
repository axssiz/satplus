"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveJobListing } from "@/app/actions/jobs";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, type EmploymentType, type ExperienceLevel } from "@/lib/validation";

export type JobListingFormValues = {
  id: string | null;
  categoryId: string;
  title: string;
  employerName: string;
  employmentType: EmploymentType;
  experience: ExperienceLevel;
  schedule: string;
  salaryFrom: string;
  salaryTo: string;
  salaryNote: string;
  description: string;
  address: string;
  contactName: string;
  phone: string;
  hasWhatsapp: boolean;
  email: string;
  linkUrl: string;
};

const FIELD_ERRORS = [
  "category",
  "title",
  "employerName",
  "description",
  "phone",
  "salary",
  "salaryOrder",
  "email",
  "contactName",
  "url",
  "consent",
] as const;
const PHONE = /^\+?[0-9 ()-]{6,24}$/;
const salaryValue = (s: string) => s.replace(/[\s ₸]/g, "");

/** Create (values.id = null) or edit the signed-in employer's own vacancy. Both go to moderation. */
export function JobListingForm({ values: v, categories }: { values: JobListingFormValues; categories: { id: string; name: string }[] }) {
  const t = useTranslations("jobForm");
  const tj = useTranslations("jobs");
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
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
        <Link href="/jobs/my" className={buttonVariants()}>
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
        if (s("title").length < 3 || s("title").length > 120) local.title = "title";
        if (s("employerName").length < 2 || s("employerName").length > 120) local.employerName = "employerName";
        if (s("description").length < 20 || s("description").length > 5000) local.description = "description";
        if (!PHONE.test(s("phone"))) local.phone = "phone";
        const from = salaryValue(s("salaryFrom"));
        const to = salaryValue(s("salaryTo"));
        const okSalary = (x: string) => x === "" || (/^[0-9]{1,8}$/.test(x) && Number(x) >= 1 && Number(x) <= 10_000_000);
        if (!okSalary(from)) local.salaryFrom = "salary";
        if (!okSalary(to)) local.salaryTo = "salary";
        else if (from && to && okSalary(from) && Number(from) > Number(to)) local.salaryTo = "salaryOrder";
        if (s("contactName") && s("contactName").length < 2) local.contactName = "contactName";
        if (s("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s("email"))) local.email = "email";
        if (s("linkUrl") && !/^https:\/\//i.test(s("linkUrl"))) local.linkUrl = "url";
        if (!fd.get("consent")) local.consent = "consent";
        setErrors(local);
        if (Object.keys(local).length) {
          toast.error(t("errors.validation"));
          return;
        }
        start(async () => {
          const res = await saveJobListing(fd);
          if (res.ok) {
            if (v.id) {
              toast.success(t("success"));
              router.push("/jobs/my");
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

      <div className="space-y-1.5">
        <Label htmlFor="title">{t("title")}</Label>
        <Input id="title" name="title" maxLength={120} placeholder={t("titlePlaceholder")} defaultValue={v.title} aria-invalid={!!errors.title} />
        <FieldError>{err("title")}</FieldError>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="employerName">{t("employerName")}</Label>
          <Input id="employerName" name="employerName" maxLength={120} defaultValue={v.employerName} aria-invalid={!!errors.employerName} />
          <FieldHint>{t("employerNameHint")}</FieldHint>
          <FieldError>{err("employerName")}</FieldError>
        </div>
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
          <Label htmlFor="employmentType">{t("employmentType")}</Label>
          <NativeSelect id="employmentType" name="employmentType" defaultValue={v.employmentType}>
            {EMPLOYMENT_TYPES.map((x) => (
              <option key={x} value={x}>
                {tj(`employmentTypes.${x}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="experience">{t("experience")}</Label>
          <NativeSelect id="experience" name="experience" defaultValue={v.experience}>
            {EXPERIENCE_LEVELS.map((x) => (
              <option key={x} value={x}>
                {tj(`experienceLevels.${x}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="schedule">{t("schedule")}</Label>
        <Input id="schedule" name="schedule" maxLength={120} placeholder={t("schedulePlaceholder")} defaultValue={v.schedule} />
      </div>

      <fieldset className="space-y-3 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">{tj("salary")}</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salaryFrom">{t("salaryFrom")}</Label>
            <Input id="salaryFrom" name="salaryFrom" inputMode="numeric" maxLength={14} defaultValue={v.salaryFrom} aria-invalid={!!errors.salaryFrom} />
            <FieldError>{err("salaryFrom")}</FieldError>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salaryTo">{t("salaryTo")}</Label>
            <Input id="salaryTo" name="salaryTo" inputMode="numeric" maxLength={14} defaultValue={v.salaryTo} aria-invalid={!!errors.salaryTo} />
            <FieldError>{err("salaryTo")}</FieldError>
          </div>
        </div>
        <FieldHint>{t("salaryHint")}</FieldHint>
        <div className="space-y-1.5">
          <Label htmlFor="salaryNote">{t("salaryNote")}</Label>
          <Input id="salaryNote" name="salaryNote" maxLength={120} placeholder={t("salaryNotePlaceholder")} defaultValue={v.salaryNote} />
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={8}
          maxLength={5000}
          placeholder={t("descriptionPlaceholder")}
          defaultValue={v.description}
          aria-invalid={!!errors.description}
        />
        <FieldError>{err("description")}</FieldError>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">{t("address")}</Label>
          <Input id="address" name="address" maxLength={200} placeholder={t("addressPlaceholder")} defaultValue={v.address} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">{t("contactName")}</Label>
          <Input id="contactName" name="contactName" maxLength={80} defaultValue={v.contactName} aria-invalid={!!errors.contactName} />
          <FieldError>{err("contactName")}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" maxLength={24} autoComplete="tel" defaultValue={v.phone} aria-invalid={!!errors.phone} />
          <FieldHint>{t("phoneHint")}</FieldHint>
          <FieldError>{err("phone")}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" inputMode="email" maxLength={254} defaultValue={v.email} aria-invalid={!!errors.email} />
          <FieldHint>{t("emailHint")}</FieldHint>
          <FieldError>{err("email")}</FieldError>
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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? t("submitting") : v.id ? t("save") : t("submit")}
      </Button>
    </form>
  );
}
