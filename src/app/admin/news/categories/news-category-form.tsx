"use client";

import { saveNewsCategory } from "@/app/actions/admin-news";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ActionForm, Check } from "../../_components/forms";

type Values = { id: string; slug: string; name_ru: string; name_kk: string; sort_order: number; is_active: boolean };

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </label>
  );
}

export function NewsCategoryForm({ v }: { v?: Values }) {
  return (
    <ActionForm action={saveNewsCategory} resetOnSuccess={!v} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {(pending) => (
        <>
          {v && <input type="hidden" name="id" value={v.id} />}
          <F label="Название RU"><Input name="name_ru" required minLength={2} maxLength={60} defaultValue={v?.name_ru} className="h-10" /></F>
          <F label="Название KZ"><Input name="name_kk" required minLength={2} maxLength={60} defaultValue={v?.name_kk} className="h-10" /></F>
          <F label="Слаг"><Input name="slug" required pattern="[a-z0-9\-]{2,64}" defaultValue={v?.slug} className="h-10" /></F>
          <F label="Порядок"><Input name="sort_order" type="number" min={0} defaultValue={v?.sort_order ?? 100} className="h-10" /></F>
          <div className="flex items-end justify-between gap-2">
            <Check name="is_active" label="Активна" defaultChecked={v?.is_active ?? true} />
            <Button size="sm" disabled={pending}>{v ? "Сохранить" : "Добавить"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
