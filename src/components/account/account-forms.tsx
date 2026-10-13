"use client";

import { Loader2, LogOut, Mail, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMyData, sendMagicLink, signOut, updateDisplayName } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations("account");
  const [pending, start] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo)
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-primary-soft p-4 text-sm">
        <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {t("linkSent", { email: sentTo })}
      </p>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await sendMagicLink(fd);
          if (res.ok) setSentTo(String(fd.get("email")));
          else toast.error(t(res.error === "email" ? "errors.email" : "errors.send"));
        });
      }}
    >
      <input type="hidden" name="next" value={next ?? "/account"} />
      <Label htmlFor="email">{t("email")}</Label>
      <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} {t("sendLink")}
      </Button>
    </form>
  );
}

export function DisplayNameForm({ initial }: { initial: string }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateDisplayName(fd);
          if (res.ok) toast.success(t("common.save"));
          else toast.error(t("addPrice.errors.validation"));
        });
      }}
    >
      <Input name="displayName" defaultValue={initial} minLength={2} maxLength={40} aria-label={t("account.displayName")} placeholder={t("account.displayName")} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function SignOutButton() {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOut();
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden /> {t("signOut")}
    </Button>
  );
}

export function DeleteDataButton() {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-danger">
          <Trash2 aria-hidden /> {t("account.deleteData")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("common.close")}>
        <DialogHeader>
          <DialogTitle>{t("account.deleteConfirm")}</DialogTitle>
          <DialogDescription>{t("account.deleteDataHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">{t("common.cancel")}</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteMyData();
                if (res.ok) {
                  toast.success(t("account.deleted"));
                  router.replace("/");
                  router.refresh();
                } else toast.error(t("addPrice.errors.server"));
              })
            }
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />} {t("common.delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
