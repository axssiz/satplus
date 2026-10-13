"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rejectBusinessSubmission } from "@/app/actions/admin-businesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAction } from "../../_components/forms";

const REASONS = ["Не удалось подтвердить данные", "Организация не в Сатпаеве", "Уже есть в справочнике", "Реклама или спам", "Данные в карточке верны"];

export function RejectBusinessSuggestion({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [reason, setReason] = useState("");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => rejectBusinessSubmission(id, reason),
          () => {
            if (redirectTo) router.replace(redirectTo);
          },
        );
      }}
    >
      <Input
        list={`biz-reasons-${id}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Причина отклонения"
        aria-label="Причина отклонения"
        required
        minLength={2}
        maxLength={300}
        className="h-10"
      />
      <datalist id={`biz-reasons-${id}`}>
        {REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <Button type="submit" size="sm" variant="secondary" className="h-10" disabled={pending}>
        Отклонить
      </Button>
    </form>
  );
}
