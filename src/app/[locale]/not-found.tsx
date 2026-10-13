import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations();
  return (
    <Container className="pt-16">
      <EmptyState
        icon={SearchX}
        title={t("errors.notFoundTitle")}
        description={t("errors.notFoundText")}
        action={<Link href="/" className={buttonVariants()}>{t("common.toHome")}</Link>}
      />
    </Container>
  );
}
