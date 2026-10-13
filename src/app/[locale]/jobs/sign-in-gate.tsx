import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/account/account-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown instead of employer pages until they sign in (magic link brings them back to `next`). */
export async function JobSignInGate({ next }: { next: string }) {
  const t = await getTranslations("jobForm");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("signInTitle")}</CardTitle>
        <CardDescription>{t("signInHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm next={next} />
      </CardContent>
    </Card>
  );
}
