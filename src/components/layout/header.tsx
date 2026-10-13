import { MapPin, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SatLogo } from "@/components/brand";
import { Link } from "@/i18n/navigation";
import { Container } from "./container";
import { DesktopNav } from "./desktop-nav";
import { LanguageSwitcher } from "./language-switcher";
import { MenuSheet } from "./menu-sheet";
import { ThemeToggleButton } from "./theme-toggle";

export async function Header() {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-16 items-center gap-2 sm:gap-3">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="Sat+">
          <SatLogo />
        </Link>
        <span className="hidden items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground min-[360px]:inline-flex">
          <MapPin className="size-3.5 text-primary" aria-hidden />
          {t("common.city")}
        </span>
        <DesktopNav />
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/search"
            aria-label={t("nav.search")}
            className="hidden size-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground md:grid"
          >
            <Search className="size-[18px]" />
          </Link>
          <Suspense fallback={<div className="h-9 w-[76px] rounded-xl bg-surface-2" />}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggleButton className="hidden md:grid" />
          <MenuSheet />
        </div>
      </Container>
    </header>
  );
}
