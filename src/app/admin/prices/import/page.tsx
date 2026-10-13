import { PageHeader } from "../../_components/ui";
import { adminPage, loadBranches } from "../../_components/data";
import { CsvImport } from "./csv-import";

export const metadata = { title: "Импорт цен" };

export default async function ImportPage() {
  const { db } = await adminPage();
  const branches = (await loadBranches(db)).filter((b) => !b.is_demo);
  return (
    <>
      <PageHeader
        title="Импорт цен из CSV"
        description="Сначала файл проверяется без записи. Записать можно только файл без ошибок — все строки сохраняются одной транзакцией. Excel: «Сохранить как → CSV UTF-8»."
      />
      <CsvImport branchSlugs={branches.map((b) => ({ slug: b.slug, label: `${b.store_name} · ${b.name}` }))} />
    </>
  );
}
