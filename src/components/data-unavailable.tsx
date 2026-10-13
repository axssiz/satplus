import { DatabaseZap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfigurationError } from "@/lib/env";

export async function DataUnavailable({ error }: { error: unknown }) {
  const t = await getTranslations("common");
  const notConfigured = error instanceof ConfigurationError;
  return (
    <EmptyState
      icon={DatabaseZap}
      title={notConfigured ? t("notConfigured") : t("loadError")}
      description={notConfigured ? undefined : t("loadErrorHint")}
    />
  );
}

/** Runs a loader and returns either its data or the error (rendered by the caller). */
export async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) console.error("[load]", error);
    return { ok: false, error };
  }
}
