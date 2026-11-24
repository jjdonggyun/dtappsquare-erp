import Link from "next/link";
import { requireAnyPage } from "@/shared/auth/account";
import {
  opportunityList,
  opportunityOptions,
} from "@/modules/sales/infrastructure/repository";
import {
  opportunityStages,
  opportunityStageLabels,
  type OpportunityStage,
} from "@/modules/sales/domain/contracts";
import { opportunityFields } from "@/components/forms/opportunity-fields";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stage?: string }>;
}) {
  const account = await requireAnyPage([
    "OPPORTUNITY_READ",
    "OPPORTUNITY_READ_ALL",
    "OPPORTUNITY_MANAGE",
  ]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.slice(0, 80) ?? "";
  const stage = opportunityStages.includes(params.stage as OpportunityStage)
    ? (params.stage as OpportunityStage)
    : "";
  const canManage = account.permissions.includes("OPPORTUNITY_MANAGE");
  const [data, rawOptions] = await Promise.all([
    opportunityList({ page, search, stage }),
    canManage ? opportunityOptions() : Promise.resolve({ customers: [], owners: [] }),
  ]);
  const owners = account.permissions.includes("OPPORTUNITY_READ_ALL")
    ? rawOptions.owners
    : rawOptions.owners.filter((owner) => owner.id === account.id);
  const queryPath = `/opportunities?q=${encodeURIComponent(search)}&stage=${encodeURIComponent(stage)}`;
  return (
    <>
      <PageHeading
        eyebrow="SALES PIPELINE"
        title="영업기회"
        description="고객 접점부터 제안, 견적, 협상과 수주까지 영업 파이프라인을 관리합니다."
      />
      <div
        className={`grid items-start gap-6 ${canManage ? "xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]" : ""}`}
      >
        <Card>
          <CardHeader>
            <CardTitle>영업 파이프라인</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-xs text-muted-foreground">
                검색
                <input
                  name="q"
                  defaultValue={search}
                  className="h-9 min-w-64 rounded-md border px-3 text-foreground"
                  placeholder="기회명, 코드, 예상 프로젝트"
                />
              </label>
              <label className="grid gap-2 text-xs text-muted-foreground">
                단계
                <select
                  name="stage"
                  defaultValue={stage}
                  className="h-9 rounded-md border px-3 text-foreground"
                >
                  <option value="">전체</option>
                  {opportunityStages.map((value) => (
                    <option key={value} value={value}>
                      {opportunityStageLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-white">
                조회
              </button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    "기회번호",
                    "고객사 / 기회명",
                    "담당",
                    "예상 계약금액",
                    "예상매출",
                    "단계",
                  ].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((opportunity) => (
                  <TableRow key={opportunity.id}>
                    <TableCell className="font-medium">{opportunity.opportunity_code}</TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground">
                        {opportunity.customer?.name ?? "고객사 정보 없음"}
                      </p>
                      <Link
                        href={`/opportunities/${opportunity.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {opportunity.title}
                      </Link>
                    </TableCell>
                    <TableCell>{opportunity.sales_owner?.name ?? "—"}</TableCell>
                    <TableCell>{money.format(opportunity.expected_amount)}원</TableCell>
                    <TableCell>
                      {money.format(opportunity.expected_revenue)}원
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({opportunity.probability}%)
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {opportunityStageLabels[opportunity.stage as OpportunityStage] ??
                          opportunity.stage}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.rows.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                조건에 맞는 영업기회가 없습니다.
              </p>
            )}
            <Pagination page={data.page} total={data.count} size={data.size} path={queryPath} />
          </CardContent>
        </Card>
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>새 영업기회</CardTitle>
            </CardHeader>
            <CardContent>
              {!rawOptions.customers.length ? (
                <p className="text-sm text-muted-foreground">
                  먼저 거래 중 상태의 고객사를 등록해 주세요.
                </p>
              ) : !owners.length ? (
                <p className="text-sm text-muted-foreground">
                  영업 담당자 역할이 지정된 활성 계정이 필요합니다.
                </p>
              ) : (
                <CommandForm
                  endpoint="/api/sales"
                  action="opportunity.save"
                  fields={opportunityFields(
                    rawOptions.customers.map((customer) => ({
                      value: customer.id,
                      label: `${customer.customer_code} · ${customer.name}`,
                    })),
                    owners.map((owner) => ({
                      value: owner.id,
                      label: owner.employee_number
                        ? `${owner.name} · ${owner.employee_number}`
                        : owner.name,
                    })),
                  )}
                  submit="영업기회 등록"
                  columns={1}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

