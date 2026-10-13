import { TriangleAlert } from "lucide-react";

export const NEWS_STATUS = {
  draft: { label: "Черновик", tone: "neutral" },
  published: { label: "Опубликована", tone: "primary" },
  archived: { label: "В архиве", tone: "outline" },
} as const;

/** Reminds staff that the public section is still switched off by its feature flag. */
export function NewsFlagNotice({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Раздел «Новости» выключен флагом (features.news). Материалы можно готовить заранее, читатели увидят их после включения.
    </p>
  );
}

/** True when the date is still ahead (scheduled publication). */
export function isFuture(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso).getTime() > Date.now();
}
