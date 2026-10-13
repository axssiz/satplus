import { TriangleAlert } from "lucide-react";

export const JOB_STATUS = {
  pending: { label: "На проверке", tone: "info" },
  published: { label: "Опубликована", tone: "primary" },
  rejected: { label: "Отклонена", tone: "danger" },
  archived: { label: "Закрыта", tone: "outline" },
} as const;

export const EMPLOYMENT_LABEL: Record<string, string> = {
  full: "Полная занятость",
  part: "Частичная занятость",
  shift: "Сменный график или вахта",
  temporary: "Временная работа",
  internship: "Стажировка",
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  any: "Опыт не важен",
  none: "Без опыта",
  "1_3": "Опыт от 1 года",
  "3_plus": "Опыт от 3 лет",
};

/** Salary as stated, for staff screens. */
export function salaryText(from: unknown, to: unknown): string {
  const f = from == null ? null : Number(from).toLocaleString("ru-RU");
  const t = to == null ? null : Number(to).toLocaleString("ru-RU");
  if (f && t) return `${f} – ${t} ₸`;
  if (f) return `от ${f} ₸`;
  if (t) return `до ${t} ₸`;
  return "не указана";
}

/** Reminds staff that the public section is still switched off by its feature flag. */
export function JobsFlagNotice({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Раздел «Работа и вакансии» выключен флагом (features.jobs). Вакансии можно проверять заранее, читатели увидят их после включения.
    </p>
  );
}
