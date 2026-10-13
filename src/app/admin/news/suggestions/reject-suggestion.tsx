"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rejectNewsSubmission } from "@/app/actions/admin-news";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAction } from "../../_components/forms";

const REASONS = ["Нет подтверждения из источника", "Не относится к Сатпаеву", "Реклама или спам", "Повтор уже опубликованной новости"];

export function RejectSuggestion({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [reason, setReason] = useState("");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => rejectNewsSubmission(id, reason),
          () => {
            if (redirectTo) router.replace(redirectTo);
          },
        );
      }}
    >
      <Input
        list={`reasons-${id}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Причина отклонения"
        aria-label="Причина отклонения"
        required
        minLength={2}
        maxLength={300}
        className="h-10"
      />
      <datalist id={`reasons-${id}`}>
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
