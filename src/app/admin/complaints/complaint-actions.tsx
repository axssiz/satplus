"use client";

import { useState } from "react";
import { resolveListingComplaint } from "@/app/actions/admin-services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAction } from "../_components/forms";

export function ComplaintActions({ id, canHide }: { id: string; canHide: boolean }) {
  const { pending, run } = useAdminAction();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Комментарий (необязательно)" aria-label="Комментарий" className="h-10" />
      <div className="flex flex-wrap gap-2">
        {canHide && (
          <Button type="button" size="sm" variant="danger" disabled={pending} onClick={() => run(() => resolveListingComplaint(id, "resolved", note, true))}>
            Скрыть с сайта
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveListingComplaint(id, "resolved", note, false))}>
          Закрыть (разобрались)
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => resolveListingComplaint(id, "dismissed", note, false))}>
          Отклонить жалобу
        </Button>
      </div>
    </div>
  );
}
