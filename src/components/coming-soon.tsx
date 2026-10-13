import { createElement } from "react";
import { ArrowLeft, Check, Sparkles, Tag } from "lucide-react";
import { getMessages, getTranslations } from "next-intl/server";
import { sectionIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import type { Section } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** The "В разработке" page shown for every Sat+ section whose feature flag is off. */
export async function ComingSoon({ section: s }: { section: Section }) {
  const t = await getTranslations();
  const icon = sectionIcon(s.icon);
  const messages = await getMessages();
  const features = ((messages.sections as Record<string, { features?: string[] }>)[s.key]?.features ?? []) as string[];

  return (
    <Container className="max-w-3xl pt-8 sm:pt-14">
      <article className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-center shadow-soft sm:p-10">
        {/* Thematic illustration: orbiting tiles around the section icon */}
        <div aria-hidden className="relative mx-auto mb-6 grid size-44 place-items-center">
          <div className="absolute inset-0 rounded-full border border-dashed border-border" />
          <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle,var(--primary-soft),transparent_70%)]" />
          <span className="absolute left-2 top-6 size-3 rounded-full bg-deal" />
          <span className="absolute bottom-5 right-4 size-4 rounded-lg bg-primary/30" />
          <span className="absolute right-1 top-12 size-2 rounded-full bg-primary" />
          <span className={cn("relative grid size-24 place-items-center rounded-[2rem] shadow-lift", s.accent, "bg-card")}>
            <span className={cn("absolute inset-0 rounded-[2rem]", s.accent)} />
            {createElement(icon, { className: "relative size-11", strokeWidth: 1.7 })}
          </span>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-foreground">
          <Sparkles className="size-3.5" aria-hidden /> {t("comingSoon.status")}
        </p>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-4xl">{t(`sections.${s.key}.title`)}</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t(`sections.${s.key}.description`)}</p>

        <div className="mx-auto mt-8 max-w-md rounded-2xl bg-surface p-5 text-left">
          <h2 className="text-sm font-semibold">{t("comingSoon.whatWillBe")}</h2>
          <ul className="mt-3 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 font-display text-lg font-semibold text-primary-strong dark:text-primary">{t("comingSoon.soonIn")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("comingSoon.meanwhile")}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/prices" className={buttonVariants({ size: "lg" })}>
            <Tag aria-hidden /> {t("common.toPrices")}
          </Link>
          <Link href="/" className={buttonVariants({ size: "lg", variant: "outline" })}>
            <ArrowLeft aria-hidden /> {t("common.toHome")}
          </Link>
        </div>
      </article>
    </Container>
  );
}
