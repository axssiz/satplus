"use client";

import { Flag, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reportJobListing } from "@/app/actions/jobs";
import { reportServiceListing } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { LISTING_COMPLAINT_REASONS } from "@/lib/validation";

/** Collapsed «Пожаловаться» form under a service listing or a vacancy. */
export function ServiceComplaintForm({ slug, target = "service" }: { slug: string; target?: "service" | "job" }) {
  const t = useTranslations(target === "job" ? "jobComplaint" : "serviceComplaint");
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sent) return <p role="status" className="rounded-2xl bg-primary-soft p-4 text-sm">{t("success")}</p>;
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag aria-hidden /> {t("title")}
      </Button>
    );
  }
  return (
    <form
      noValidate
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!fd.get("reason")) {
          setError(t("errors.reason"));
          return;
        }
        setError(null);
        start(async () => {
          const res = await (target === "job" ? reportJobListing : reportServiceListing)(fd);
          if (res.ok) {
            setSent(true);
            toast.success(t("success"));
          } else {
            const msg = t(`errors.${res.error}` as "errors.server");
            setError(msg);
            toast.error(msg);
          }
        });
      }}
    >
      <h2 className="font-semibold">{t("title")}</h2>
      <input type="hidden" name="listingSlug" value={slug} />
      <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="space-y-1.5">
        <Label htmlFor="complaint-reason">{t("reason")}</Label>
        <NativeSelect id="complaint-reason" name="reason" defaultValue="">
          <option value="" disabled>
            {t("reasonChoose")}
          </option>
          {LISTING_COMPLAINT_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`reasons.${r}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="complaint-message">{t("message")}</Label>
        <Textarea id="complaint-message" name="message" rows={3} maxLength={1000} />
        <FieldHint>{t("messageHint")}</FieldHint>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
