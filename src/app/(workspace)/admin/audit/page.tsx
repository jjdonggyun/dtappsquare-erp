import { requirePage } from "@/shared/auth/account";
import { auditList } from "@/modules/audit/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { environment } from "@/shared/infrastructure/env";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; action?: string }>;
}) {
  await requirePage("AUDIT_READ");
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  const entityType = params.entity?.slice(0, 80) ?? "";
  const action = ["INSERT", "UPDATE", "DELETE"].includes(params.action ?? "") ? params.action! : "";
  const [data, catalogs] = await Promise.all([
    auditList({ page, entityType, action }),
    organizationCatalogs(),
  ]);
  const people = new Map(catalogs.directory.map((person) => [person.id, person.name]));
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: environment().COMPANY_TIMEZONE,
    dateStyle: "short",
    timeStyle: "medium",
  });
  return (
    <>
      <PageHeading
        eyebrow="ACTIVITY & GOVERNANCE"
        title="감사 로그"
        description="관리 데이터의 변경 전후 기록입니다. 감사 기록은 수정하거나 삭제할 수 없습니다."
      />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="grid gap-2 text-xs text-muted-foreground">대상 유형<input name="entity" defaultValue={entityType} className="h-9 rounded-md border px-3 text-foreground" placeholder="예: project_assignments"/></label>
        <label className="grid gap-2 text-xs text-muted-foreground">변경 유형<select name="action" defaultValue={action} className="h-9 rounded-md border px-3 text-foreground"><option value="">전체</option><option value="INSERT">생성</option><option value="UPDATE">수정</option><option value="DELETE">삭제</option></select></label>
        <button className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-white">조회</button>
      </form>
      <Card>
        <CardContent className="py-5">
          <Table>
            <TableHeader>
              <TableRow>
                {["일시", "변경", "대상", "행위자", "상세"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatter.format(new Date(row.created_at))}
                  </TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>
                    {row.entity_type}
                    <span className="block max-w-44 truncate text-xs text-muted-foreground">
                      {row.entity_id}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-40 truncate">
                    {row.actor_user_id ? people.get(row.actor_user_id) ?? row.actor_user_id : "시스템"}
                  </TableCell>
                  <TableCell>
                    <details>
                      <summary className="text-primary">변경 내용</summary>
                      <pre className="mt-3 max-h-64 max-w-md overflow-auto text-xs">
                        {JSON.stringify(
                          { before: row.before_data, after: row.after_data },
                          null,
                          2,
                        )}
                      </pre>
                      <p className="mt-2 text-[10px] text-muted-foreground">Request {row.request_id ?? "—"} · IP {String(row.ip_address ?? "—")}</p>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={data.count} size={30} path={`/admin/audit?entity=${encodeURIComponent(entityType)}&action=${encodeURIComponent(action)}`} />
        </CardContent>
      </Card>
    </>
  );
}
