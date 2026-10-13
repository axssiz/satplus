import { TriangleAlert } from "lucide-react";

export const SERVICE_STATUS = {
  pending: { label: "На проверке", tone: "info" },
  published: { label: "Опубликовано", tone: "primary" },
  rejected: { label: "Отклонено", tone: "danger" },
  archived: { label: "Снято", tone: "outline" },
} as const;


/** Reminds staff that the public section is still switched off by its feature flag. */
export function ServicesFlagNotice({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Раздел «Услуги и мастера» выключен флагом (features.services). Объявления можно проверять заранее, читатели увидят их после включения.
    </p>
  );
}
