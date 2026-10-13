import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import ruMessages from "../../../messages/ru.json";
import { AppProviders } from "@/components/providers/app-providers";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { onest, unbounded } from "@/lib/fonts";
import { AdminNav } from "./_components/admin-nav";

export const metadata: Metadata = {
  title: { default: "Админ-панель · Sat+", template: "%s · Админ Sat+" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Gate({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldAlert className="size-12 text-danger" aria-hidden />
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{text}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
        <Button asChild>
          <Link href="/account?next=/admin">Войти</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  let content: React.ReactNode;
  if (!isSupabaseConfigured()) {
    content = <Gate title="Supabase не настроен" text="Заполните переменные окружения из .env.example, чтобы открыть админ-панель." />;
  } else if (!user) {
    content = <Gate title="Нужен вход" text="Войдите в аккаунт с ролью модератора или администратора." />;
  } else if (!user.isModerator) {
    content = <Gate title="403 — нет доступа" text="У вашего аккаунта нет роли модератора или администратора." />;
  } else {
    content = (
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <AdminNav email={user.email} isAdmin={user.isAdmin} />
        <main id="main" className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <html lang="ru" className={`${onest.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background antialiased">
        <NextIntlClientProvider locale="ru" messages={{ common: ruMessages.common }} timeZone="Asia/Almaty">
          <AppProviders>{content}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
