import { getTranslations } from "next-intl/server";
import { SatLogo } from "@/components/brand";
import { Link } from "@/i18n/navigation";
import { Container } from "./container";

export async function Footer() {
  const t = await getTranslations();
  return (
    <footer className="mt-16 border-t border-border bg-surface/60 pb-28 pt-10 md:pb-10">
      <Container className="grid gap-6 text-sm text-muted-foreground md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <SatLogo className="text-lg text-foreground" />
          <p className="max-w-xl">{t("footer.about")}</p>
          <p className="max-w-xl">{t("footer.prices")}</p>
          <p className="max-w-xl">{t("footer.ads")}</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 md:flex-col md:items-end">
          <li><Link className="hover:text-foreground" href="/prices">QaiArzan</Link></li>
          <li><Link className="hover:text-foreground" href="/privacy">{t("more.privacy")}</Link></li>
          <li><Link className="hover:text-foreground" href="/terms">{t("more.terms")}</Link></li>
          <li><Link className="hover:text-foreground" href="/account">{t("nav.account")}</Link></li>
        </ul>
      </Container>
    </footer>
  );
}
