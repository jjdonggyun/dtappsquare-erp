import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPage } from "@/shared/auth/account";
import {
  opportunityDetail,
  opportunityOptions,
} from "@/modules/sales/infrastructure/repository";
import {
  opportunityStageLabels,
  opportunityTransitions,
  type OpportunityStage,
} from "@/modules/sales/domain/contracts";
import { opportunityFields } from "@/components/forms/opportunity-fields";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAnyPage([
    "OPPORTUNITY_READ",
    "OPPORTUNITY_READ_ALL",
    "OPPORTUNITY_MANAGE",
  ]);
  const { id } = await params;
  const opportunity = await opportunityDetail(id);
  if (!opportunity) notFound();
  const canManage =
    account.permissions.includes("OPPORTUNITY_MANAGE") &&
    (opportunity.sales_owner_id === account.id ||
      account.permissions.includes("OPPORTUNITY_READ_ALL"));
  const rawOptions = canManage
    ? await opportunityOptions()
    : { customers: [], owners: [] };
  const owners = account.permissions.includes("OPPORTUNITY_READ_ALL")
    ? rawOptions.owners
    : rawOptions.owners.filter((owner) => owner.id === account.id);
  const stage = opportunity.stage as OpportunityStage;
  const transitions = opportunityTransitions[stage] ?? [];
  return (
    <>
      <PageHeading
        eyebrow={opportunity.opportunity_code}
        title={opportunity.title}
        description={`${opportunity.customer?.name ?? "고객사 정보 없음"} · ${opportunity.expected_project_name || "예상 프로젝트명 미정"}`}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">현재 단계</p>
            <Badge className="mt-2" variant="outline">
              {opportunityStageLabels[stage] ?? stage}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">예상 계약금액</p>
            <p className="mt-2 text-xl font-bold">{money.format(opportunity.expected_amount)}원</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">예상매출</p>
            <p className="mt-2 text-xl font-bold">{money.format(opportunity.expected_revenue)}원</p>
            <p className="text-xs text-muted-foreground">수주 가능성 {opportunity.probability}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">담당 영업</p>
            <p className="mt-2 font-semibold">{opportunity.sales_owner?.name ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>영업기회 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage && !["WON", "LOST", "ARCHIVED"].includes(stage) ? (
              <CommandForm
                endpoint="/api/sales"
                action="opportunity.save"
                constants={{ id: opportunity.id, version: opportunity.version }}
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
                  opportunity,
                )}
                submit="영업기회 저장"
              />
            ) : (
              <dl className="grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">고객사</dt>
                  <dd className="mt-1 font-medium">
                    {opportunity.customer ? (
                      <Link className="text-primary hover:underline" href={`/customers/${opportunity.customer.id}`}>
                        {opportunity.customer.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">제안 예정일</dt>
                  <dd className="mt-1 font-medium">{opportunity.proposal_due_date ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">예상 기간</dt>
                  <dd className="mt-1 font-medium">
                    {opportunity.expected_start_date ?? "—"} ~ {opportunity.expected_end_date ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">경쟁사</dt>
                  <dd className="mt-1 font-medium">{opportunity.competitor || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">비고</dt>
                  <dd className="mt-1 whitespace-pre-wrap font-medium">{opportunity.note || "—"}</dd>
                </div>
                {opportunity.lost_reason && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">실주 사유</dt>
                    <dd className="mt-1 whitespace-pre-wrap font-medium">{opportunity.lost_reason}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>단계 변경</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManage ? (
                <p className="text-sm text-muted-foreground">조회 권한으로 열었습니다.</p>
              ) : !transitions.length ? (
                <p className="text-sm text-muted-foreground">
                  현재 단계에서 가능한 추가 전이가 없습니다.
                </p>
              ) : (
                transitions.map((next) =>
                  next === "LOST" ? (
                    <CommandForm
                      key={next}
                      endpoint="/api/sales"
                      action="opportunity.transition"
                      constants={{
                        id: opportunity.id,
                        version: opportunity.version,
                        to_stage: next,
                      }}
                      fields={[
                        {
                          name: "lost_reason",
                          label: "실주 사유",
                          type: "textarea",
                          required: true,
                        },
                      ]}
                      submit="실주 처리"
                      columns={1}
                    />
                  ) : (
                    <CommandForm
                      key={next}
                      endpoint="/api/sales"
                      action="opportunity.transition"
                      constants={{
                        id: opportunity.id,
                        version: opportunity.version,
                        to_stage: next,
                        lost_reason: "",
                      }}
                      submit={`${opportunityStageLabels[next]} 단계로 이동`}
                      columns={1}
                    />
                  ),
                )
              )}
            </CardContent>
          </Card>
          {canManage && stage !== "WON" && stage !== "ARCHIVED" && (
            <Card>
              <CardHeader>
                <CardTitle>보관</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  기록은 삭제하지 않고 검색 가능한 보관 상태로 전환합니다.
                </p>
                <CommandForm
                  endpoint="/api/sales"
                  action="opportunity.archive"
                  constants={{ id: opportunity.id, version: opportunity.version }}
                  submit="영업기회 보관"
                  columns={1}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

