"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-16">
      <EmptyState
        icon={TriangleAlert}
        title={t("errors.genericTitle")}
        description={t("errors.genericText")}
        action={<Button onClick={reset}><RotateCcw aria-hidden /> {t("common.retry")}</Button>}
      />
    </div>
  );
}
