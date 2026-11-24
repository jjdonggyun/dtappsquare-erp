import Link from "next/link";
import { requireAnyPage } from "@/shared/auth/account";
import { quotationList, quotationOptions } from "@/modules/quotation/infrastructure/repository";
import { quotationStatuses, quotationStatusLabels } from "@/modules/quotation/domain/contracts";
import { quotationCreateFields } from "@/components/forms/quotation-fields";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const account = await requireAnyPage([
    "QUOTATION_READ",
    "QUOTATION_READ_ALL",
    "QUOTATION_MANAGE",
    "QUOTATION_APPROVE",
  ]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.slice(0, 80) ?? "";
  const status = quotationStatuses.includes(params.status as (typeof quotationStatuses)[number])
    ? params.status!
    : "";
  const canManage = account.permissions.includes("QUOTATION_MANAGE");
  const [data, opportunities] = await Promise.all([
    quotationList({ page, search, status }),
    canManage ? quotationOptions() : Promise.resolve([]),
  ]);
  const quotationDate = new Date().toISOString().slice(0, 10);
  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + 30);
  const validUntil = validUntilDate.toISOString().slice(0, 10);
  const queryPath = `/quotations?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
  return (
    <>
      <PageHeading
        eyebrow="QUOTATION"
        title="견적"
        description="견적 항목과 금액을 구조화하고 Revision 및 내부 승인 이력을 보존합니다."
      />
      <div className={`grid items-start gap-6 ${canManage ? "xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]" : ""}`}>
        <Card>
          <CardHeader><CardTitle>견적 목록</CardTitle></CardHeader>
          <CardContent>
            <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-xs text-muted-foreground">
                견적번호
                <input name="q" defaultValue={search} className="h-9 min-w-64 rounded-md border px-3 text-foreground" placeholder="Q-202609-00001" />
              </label>
              <label className="grid gap-2 text-xs text-muted-foreground">
                상태
                <select name="status" defaultValue={status} className="h-9 rounded-md border px-3 text-foreground">
                  <option value="">전체</option>
                  {quotationStatuses.map((value) => <option key={value} value={value}>{quotationStatusLabels[value]}</option>)}
                </select>
              </label>
              <button className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-white">조회</button>
            </form>
            <Table>
              <TableHeader><TableRow>{["견적번호", "고객사 / 프로젝트", "Revision", "공급가액", "총금액", "상태"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {data.rows.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell><Link href={`/quotations/${quote.id}`} className="font-semibold text-primary hover:underline">{quote.quotation_number}</Link></TableCell>
                    <TableCell><p className="text-xs text-muted-foreground">{quote.customer?.name ?? "—"}</p><p className="font-medium">{quote.current_revision?.project_name ?? quote.opportunity?.expected_project_name ?? "—"}</p></TableCell>
                    <TableCell>V{quote.current_revision?.revision_no ?? "—"}</TableCell>
                    <TableCell>{money.format(quote.current_revision?.supply_amount ?? 0)}원</TableCell>
                    <TableCell>{money.format(quote.current_revision?.total_amount ?? 0)}원</TableCell>
                    <TableCell><Badge variant="outline">{quotationStatusLabels[quote.status] ?? quote.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.rows.length && <p className="py-12 text-center text-sm text-muted-foreground">등록된 견적이 없습니다. 첫 견적을 작성하세요.</p>}
            <Pagination page={data.page} total={data.count} size={data.size} path={queryPath} />
          </CardContent>
        </Card>
        {canManage && (
          <Card>
            <CardHeader><CardTitle>새 견적</CardTitle></CardHeader>
            <CardContent>
              {!opportunities.length ? <p className="text-sm text-muted-foreground">먼저 진행 가능한 영업기회를 등록해 주세요.</p> : (
                <CommandForm endpoint="/api/quotation" action="quotation.create" fields={quotationCreateFields(opportunities.map((opportunity) => ({ value: opportunity.id, label: `${opportunity.opportunity_code} · ${opportunity.customer?.name ?? "—"} · ${opportunity.title}` })), { quotationDate, validUntil })} submit="견적 초안 만들기" columns={1} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

