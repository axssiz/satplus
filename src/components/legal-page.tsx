import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import type { LegalDoc } from "@/content/legal";

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("legal");
  return (
    <Container className="max-w-3xl space-y-6 pt-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">{doc.updated}</p>
        <p className="rounded-xl bg-warning-soft p-3 text-xs text-warning-foreground">{t("draftNote")}</p>
      </header>
      {doc.sections.map((s) => (
        <section key={s.h} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.h}</h2>
          {s.p.map((p) => (
            <p key={p} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
          ))}
        </section>
      ))}
    </Container>
  );
}
