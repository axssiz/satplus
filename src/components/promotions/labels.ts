import "server-only";
import { getTranslations } from "next-intl/server";
import type { PromotionCardLabels } from "./promotion-card";

export async function getPromotionLabels(): Promise<PromotionCardLabels> {
  const t = await getTranslations("promotions");
  return {
    sponsored: t("sponsored"),
    ended: t("ended"),
    lastDay: t("lastDay"),
    daysLeft: (count) => t("daysLeft", { count }),
    until: (date) => t("until", { date }),
    startsIn: (date) => t("startsIn", { date }),
  };
}
