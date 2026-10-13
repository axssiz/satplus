"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { moderateServiceListing } from "@/app/actions/admin-services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAction } from "../_components/forms";

const REASONS = [
  "Нет описания услуги",
  "Неверный или чужой телефон",
  "Запрещённые услуги",
  "Реклама вместо услуги мастера",
  "Повтор уже опубликованного объявления",
  "Оскорбительное содержание",
];

/** Approve or reject a pending listing; the reason is shown to the owner in «Мои объявления». */
export function ModerateListing({ id }: { id: string }) {
  const { pending, run } = useAdminAction();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button type="button" size="sm" className="h-10" disabled={pending} onClick={() => run(() => moderateServiceListing(id, "approve"))}>
        <Check aria-hidden /> Опубликовать
      </Button>
      <form
        className="flex flex-1 flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => moderateServiceListing(id, "reject", reason));
        }}
      >
        <Input
          list={`svc-reasons-${id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина отклонения (увидит автор)"
          aria-label="Причина отклонения"
          required
          minLength={2}
          maxLength={300}
          className="h-10"
        />
        <datalist id={`svc-reasons-${id}`}>
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
