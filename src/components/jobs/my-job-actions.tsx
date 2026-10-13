"use client";

import { Archive, ArchiveRestore, CalendarPlus, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { myJobListingAction } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

type Action = "archive" | "restore" | "renew" | "delete";

/** Employer buttons on «Мои вакансии»; which ones show depends on the vacancy state. */
export function MyJobActions({ id, actions }: { id: string; actions: Action[] }) {
  const t = useTranslations("myJobs");
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: Action) => {
    if (action === "delete" && !window.confirm(t("deleteConfirm"))) return;
    start(async () => {
      const res = await myJobListingAction(id, action);
      if (res.ok) {
        toast.success(t(`done.${action}`));
        router.refresh();
      } else {
        toast.error(res.error === "renewTooEarly" ? t("errors.renewTooEarly") : t("errors.server"));
      }
    });
  };
  const icon = { renew: CalendarPlus, archive: Archive, restore: ArchiveRestore, delete: Trash2 } as const;
  return (
    <>
      {actions.map((a) => {
        const Icon = pending ? Loader2 : icon[a];
        return (
          <Button key={a} type="button" size="sm" variant={a === "delete" ? "ghost" : "outline"} disabled={pending} onClick={() => run(a)}>
            <Icon className={pending ? "animate-spin" : undefined} aria-hidden /> {t(a)}
          </Button>
        );
      })}
    </>
  );
}
