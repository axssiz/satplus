"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { AdminResult } from "@/app/actions/admin";

/** Runs an admin server action, shows a toast and refreshes server data on success. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run<T>(fn: () => Promise<AdminResult<T>>, onOk?: (r: AdminResult<T> & { ok: true }) => void) {
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          if (r.message) toast.success(r.message);
          onOk?.(r);
          router.refresh();
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Не удалось выполнить действие. Проверьте соединение.");
      }
    });
  }
  return { pending, run };
}

/** A form bound to a FormData admin action. */
export function ActionForm({
  action,
  children,
  className,
  onDone,
  resetOnSuccess = false,
}: {
  action: (fd: FormData) => Promise<AdminResult<unknown>>;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
  onDone?: () => void;
  resetOnSuccess?: boolean;
}) {
  const { pending, run } = useAdminAction();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        run(
          () => action(fd),
          () => {
            if (resetOnSuccess) form.reset();
            onDone?.();
          },
        );
      }}
    >
      {children(pending)}
    </form>
  );
}

export function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}
