"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { moderateJobListing } from "@/app/actions/admin-jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAction } from "../_components/forms";

const REASONS = [
  "Не указаны обязанности или условия",
  "Неверный или чужой телефон",
  "Требуют оплату от соискателя",
  "Дискриминационные требования (пол, возраст, национальность)",
  "Не вакансия: реклама, сетевой маркетинг или услуги",
  "Повтор уже опубликованной вакансии",
  "Оскорбительное содержание",
];

/** Approve or reject a pending vacancy; the reason is shown to the employer in «Мои вакансии». */
export function ModerateJob({ id }: { id: string }) {
  const { pending, run } = useAdminAction();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button type="button" size="sm" className="h-10" disabled={pending} onClick={() => run(() => moderateJobListing(id, "approve"))}>
        <Check aria-hidden /> Опубликовать
      </Button>
      <form
        className="flex flex-1 flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => moderateJobListing(id, "reject", reason));
        }}
      >
        <Input
          list={`job-reasons-${id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина отклонения (увидит автор)"
          aria-label="Причина отклонения"
          required
          minLength={2}
          maxLength={300}
          className="h-10"
        />
        <datalist id={`job-reasons-${id}`}>
          {REASONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <Button type="submit" size="sm" variant="secondary" className="h-10" disabled={pending}>
          Отклонить
        </Button>
      </form>
    </div>
  );
}
