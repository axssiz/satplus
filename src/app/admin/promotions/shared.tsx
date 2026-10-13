import { TriangleAlert } from "lucide-react";

export const PROMOTION_STATUS = {
  draft: { label: "Черновик", tone: "neutral" },
  published: { label: "Опубликована", tone: "primary" },
  archived: { label: "Снята (скрыта)", tone: "outline" },
} as const;

/** Reminds staff that the public section is still switched off by its feature flag. */
export function PromotionsFlagNotice({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Раздел «Акции и скидки» выключен флагом (features.promotions). Акции можно готовить заранее, читатели увидят их после включения.
    </p>
  );
}
