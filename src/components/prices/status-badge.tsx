import { CheckCircle2, CircleDashed, Clock3, History, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { PriceStatus } from "@/lib/types";

const META = {
  verified: { tone: "primary", Icon: CheckCircle2 },
  estimated: { tone: "warning", Icon: CircleDashed },
  pending: { tone: "info", Icon: Clock3 },
  stale: { tone: "neutral", Icon: History },
  rejected: { tone: "danger", Icon: XCircle },
} as const;

export function PriceStatusBadge({ status, className }: { status: PriceStatus; className?: string }) {
  const t = useTranslations("status");
  const { tone, Icon } = META[status];
  return (
    <Badge tone={tone} className={className} title={t(`${status}Hint`)}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="demo" className={className} title="DEMO">
      DEMO
    </Badge>
  );
}
