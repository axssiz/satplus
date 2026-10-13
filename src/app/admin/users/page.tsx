import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminError, Empty, PageHeader, TableWrap } from "../_components/ui";
import { adminPage, fmtDate } from "../_components/data";
import { RoleToggle } from "../_components/entity-forms";

export const metadata = { title: "Пользователи и роли" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { db, user: me } = await adminPage("admin");
  const q = typeof (await searchParams).q === "string" ? String((await searchParams).q).trim() : "";

  const { data: roleRows, error: rErr } = await db.from("user_roles").select("user_id, role");
  if (rErr) return <AdminError message={rErr.message} />;
  const staffIds = [...new Set((roleRows ?? []).map((r) => String(r.user_id)))];

  let query = db.from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.or(`email.ilike.%${q.replace(/[%,()]/g, "")}%,display_name.ilike.%${q.replace(/[%,()]/g, "")}%`);
  else if (staffIds.length) query = query.in("id", staffIds);
  const { data: users, error } = await query;
  if (error) return <AdminError message={error.message} />;

  const ids = (users ?? []).map((u) => String(u.id));
  const { data: reps } = ids.length ? await db.from("user_reputation").select("user_id, points, approved_actions").in("user_id", ids) : { data: [] };

  return (
    <>
      <PageHeader
        title="Пользователи и роли"
        description="Без поиска показаны сотрудники. Найдите пользователя по e-mail, чтобы выдать роль. Последнего администратора снять нельзя."
      />
      <form className="mb-4 flex max-w-lg gap-2">
        <Input name="q" defaultValue={q} placeholder="E-mail или имя" aria-label="Поиск пользователя" />
        <Button variant="secondary">Найти</Button>
      </form>
      {(users ?? []).length === 0 ? (
        <Empty>Никого не найдено.</Empty>
      ) : (
        <TableWrap>
          <thead><tr><th>Пользователь</th><th>Регистрация</th><th>Репутация</th><th>Роли</th></tr></thead>
          <tbody>
            {(users ?? []).map((u) => {
              const roles = (roleRows ?? []).filter((r) => r.user_id === u.id).map((r) => r.role);
              const rep = (reps ?? []).find((r) => r.user_id === u.id);
              return (
                <tr key={String(u.id)}>
                  <td>
                    <p className="font-medium">{String(u.display_name ?? "Без имени")}</p>
                    <p className="text-xs text-muted-foreground">{String(u.email ?? "")}</p>
                  </td>
                  <td>{fmtDate(u.created_at as string, false)}</td>
                  <td className="tabular-nums">{rep ? `${rep.points} (одобрено ${rep.approved_actions})` : "0"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <RoleToggle userId={String(u.id)} role="moderator" has={roles.includes("moderator")} />
                      <RoleToggle userId={String(u.id)} role="admin" has={roles.includes("admin")} disabled={u.id === me.id && roles.includes("admin")} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
