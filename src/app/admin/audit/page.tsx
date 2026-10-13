import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, fmtDate } from "../_components/data";

export const metadata = { title: "Журнал действий" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const { db } = await adminPage("admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const size = 50;

  const [{ data: logs, error }, { data: modActions }] = await Promise.all([
    db.from("admin_audit_logs").select("id, actor_id, action, entity_type, entity_id, details, created_at").order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1),
    db.from("moderation_actions").select("id, moderator_id, action, target_type, reason, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  if (error) return <AdminError message={error.message} />;
  const actorIds = [...new Set([...(logs ?? []).map((l) => l.actor_id), ...(modActions ?? []).map((m) => m.moderator_id)].filter(Boolean) as string[])];
  const { data: actors } = actorIds.length ? await db.from("profiles").select("id, email, display_name").in("id", actorIds) : { data: [] };
  const who = (id: unknown) => {
    const a = (actors ?? []).find((x) => x.id === id);
    return a ? String(a.display_name ?? a.email ?? "—") : "—";
  };

  return (
    <>
      <PageHeader title="Журнал действий" description="Все изменения каталога, цен, ролей и настроек, а также решения модераторов." />
      {(logs ?? []).length === 0 ? (
        <Empty>Записей пока нет.</Empty>
      ) : (
        <TableWrap>
          <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={String(l.id)}>
                <td className="whitespace-nowrap">{fmtDate(l.created_at as string)}</td>
                <td>{who(l.actor_id)}</td>
                <td><code className="text-xs">{String(l.action)}</code></td>
                <td className="text-xs">{String(l.entity_type)}{l.entity_id ? ` · ${String(l.entity_id).slice(0, 8)}` : ""}</td>
                <td className="max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(l.details)}>{JSON.stringify(l.details)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <nav className="mt-3 flex gap-3 text-sm" aria-label="Страницы журнала">
        {page > 1 && <a href={`?page=${page - 1}`} className="hover:underline">← Новее</a>}
        {(logs ?? []).length === size && <a href={`?page=${page + 1}`} className="hover:underline">Старее →</a>}
      </nav>

      <h2 className="mb-2 mt-8 font-semibold">Последние решения модерации</h2>
      {(modActions ?? []).length === 0 ? (
        <Empty>Решений пока нет.</Empty>
      ) : (
        <TableWrap>
          <thead><tr><th>Когда</th><th>Модератор</th><th>Решение</th><th>Объект</th><th>Комментарий</th></tr></thead>
          <tbody>
            {(modActions ?? []).map((m) => (
              <tr key={String(m.id)}>
                <td className="whitespace-nowrap">{fmtDate(m.created_at as string)}</td>
                <td>{who(m.moderator_id)}</td>
                <td><code className="text-xs">{String(m.action)}</code></td>
                <td className="text-xs">{String(m.target_type)}</td>
                <td className="text-xs">{String(m.reason ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
