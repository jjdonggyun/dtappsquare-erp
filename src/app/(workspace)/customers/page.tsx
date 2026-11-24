import Link from "next/link";
import { requireAnyPage } from "@/shared/auth/account";
import { customerList } from "@/modules/customer/infrastructure/repository";
import { customerStatusLabels } from "@/modules/customer/domain/contracts";
import { customerFields } from "@/components/forms/customer-fields";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const account = await requireAnyPage(["CUSTOMER_READ", "CUSTOMER_MANAGE"]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.slice(0, 80) ?? "";
  const status = ["ACTIVE", "INACTIVE", "ARCHIVED"].includes(params.status ?? "")
    ? params.status!
    : "";
  const data = await customerList({ page, search, status });
  const canManage = account.permissions.includes("CUSTOMER_MANAGE");
  const queryPath = `/customers?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
  return (
    <>
      <PageHeading
        eyebrow="CUSTOMER"
        title="고객사"
        description="영업기회, 견적, 계약과 프로젝트가 연결될 고객사 기준정보를 관리합니다."
      />
      <div className={`grid items-start gap-6 ${canManage ? "xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]" : ""}`}>
        <Card>
          <CardHeader>
            <CardTitle>고객사 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-xs text-muted-foreground">
                검색
                <input name="q" defaultValue={search} className="h-9 min-w-64 rounded-md border px-3 text-foreground" placeholder="고객사명, 코드, 사업자번호" />
              </label>
              <label className="grid gap-2 text-xs text-muted-foreground">
                상태
                <select name="status" defaultValue={status} className="h-9 rounded-md border px-3 text-foreground">
                  <option value="">전체</option>
                  <option value="ACTIVE">거래 중</option>
                  <option value="INACTIVE">거래 중지</option>
                  <option value="ARCHIVED">보관</option>
                </select>
              </label>
              <button className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-white">조회</button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  {['코드', '고객사', '사업자등록번호', '대표자', '상태'].map((label) => <TableHead key={label}>{label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.customer_code}</TableCell>
                    <TableCell><Link href={`/customers/${customer.id}`} className="font-semibold text-primary hover:underline">{customer.name}</Link></TableCell>
                    <TableCell>{customer.business_registration_number ?? "—"}</TableCell>
                    <TableCell>{customer.representative_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{customerStatusLabels[customer.status as keyof typeof customerStatusLabels] ?? customer.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.rows.length && <p className="py-12 text-center text-sm text-muted-foreground">등록된 고객사가 없습니다. 권한이 있다면 오른쪽에서 첫 고객사를 등록하세요.</p>}
            <Pagination page={data.page} total={data.count} size={data.size} path={queryPath} />
          </CardContent>
        </Card>
        {canManage && (
          <Card>
            <CardHeader><CardTitle>새 고객사</CardTitle></CardHeader>
            <CardContent>
              <CommandForm endpoint="/api/customer" action="customer.save" fields={customerFields()} submit="고객사 등록" columns={1} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
