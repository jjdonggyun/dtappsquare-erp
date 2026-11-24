import Link from "next/link";
import { requireAnyPage } from "@/shared/auth/account";
import { contractList, contractOptions } from "@/modules/contract/infrastructure/repository";
import { contractStatuses, contractStatusLabels } from "@/modules/contract/domain/contracts";
import { contractFields } from "@/components/forms/contract-fields";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  const account = await requireAnyPage(["CONTRACT_READ", "CONTRACT_READ_ALL", "CONTRACT_MANAGE", "CONTRACT_APPROVE"]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.slice(0, 80) ?? "";
  const status = contractStatuses.includes(params.status as (typeof contractStatuses)[number]) ? params.status! : "";
  const canManage = account.permissions.includes("CONTRACT_MANAGE");
  const [data, options] = await Promise.all([
    contractList({ page, search, status }),
    canManage ? contractOptions() : Promise.resolve({ sources: [], managers: [] }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const defaultEndDate = new Date(`${today}T00:00:00Z`);
  defaultEndDate.setUTCDate(defaultEndDate.getUTCDate() + 90);
  const firstSource = options.sources[0];
  const queryPath = `/contracts?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
  return <>
    <PageHeading eyebrow="CONTRACT" title="계약 · 발주" description="승인 견적을 계약으로 전환하고 승인, 서명, 프로젝트 생성을 연결합니다." />
    <div className={`grid items-start gap-6 ${canManage ? "xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]" : ""}`}>
      <Card><CardHeader><CardTitle>계약 목록</CardTitle></CardHeader><CardContent>
        <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-2 text-xs text-muted-foreground">검색<input name="q" defaultValue={search} className="h-9 min-w-64 rounded-md border px-3 text-foreground" placeholder="계약번호, 계약명, 발주번호" /></label>
          <label className="grid gap-2 text-xs text-muted-foreground">상태<select name="status" defaultValue={status} className="h-9 rounded-md border px-3 text-foreground"><option value="">전체</option>{contractStatuses.map((value) => <option key={value} value={value}>{contractStatusLabels[value]}</option>)}</select></label>
          <button className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-white">조회</button>
        </form>
        <Table><TableHeader><TableRow>{["계약번호", "고객사 / 계약명", "계약기간", "공급가액", "총금액", "상태"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
          {data.rows.map((contract) => <TableRow key={contract.id}>
            <TableCell><Link href={`/contracts/${contract.id}`} className="font-semibold text-primary hover:underline">{contract.contract_number}</Link></TableCell>
            <TableCell><p className="text-xs text-muted-foreground">{contract.customer?.name ?? "—"}</p><p className="font-medium">{contract.contract_name}</p></TableCell>
            <TableCell>{contract.start_date} ~ {contract.end_date}</TableCell>
            <TableCell>{money.format(contract.supply_amount)}원</TableCell><TableCell>{money.format(contract.total_amount)}원</TableCell>
            <TableCell><Badge variant="outline">{contractStatusLabels[contract.status] ?? contract.status}</Badge></TableCell>
          </TableRow>)}
        </TableBody></Table>
        {!data.rows.length && <p className="py-12 text-center text-sm text-muted-foreground">등록된 계약이 없습니다.</p>}
        <Pagination page={data.page} total={data.count} size={data.size} path={queryPath} />
      </CardContent></Card>
      {canManage && <Card><CardHeader><CardTitle>승인 견적에서 계약 생성</CardTitle></CardHeader><CardContent>
        {!options.sources.length ? <p className="text-sm text-muted-foreground">계약으로 전환할 승인 견적이 없습니다.</p> : <CommandForm endpoint="/api/contract" action="contract.create" constants={{}} fields={[
          { name: "quotation_revision_id", label: "승인 견적", type: "select", required: true, options: options.sources.map(({ revision, quote }) => ({ value: revision.id, label: `${quote.quotation_number} · ${quote.customer?.name ?? "—"} · V${revision.revision_no}` })) },
          ...contractFields({ contractDate: today, startDate: today, endDate: firstSource?.revision ? defaultEndDate.toISOString().slice(0, 10) : today, supplyAmount: firstSource?.revision.supply_amount ?? 0, vatRate: firstSource?.revision.vat_rate ?? 10 }),
        ]} submit="계약 초안 만들기" columns={1} />}
      </CardContent></Card>}
    </div>
  </>;
}
