import Link from "next/link";
import { notFound } from "next/navigation";
import { CommandForm } from "@/components/command-form";
import { contractFields } from "@/components/forms/contract-fields";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { contractStatusLabels } from "@/modules/contract/domain/contracts";
import { contractDetail, contractOptions } from "@/modules/contract/infrastructure/repository";
import { requireAnyPage } from "@/shared/auth/account";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireAnyPage([
    "CONTRACT_READ",
    "CONTRACT_READ_ALL",
    "CONTRACT_MANAGE",
    "CONTRACT_APPROVE",
  ]);
  const { id } = await params;
  const detail = await contractDetail(id);
  if (!detail) notFound();

  const { contract, amendments, project } = detail;
  const canManage = account.permissions.includes("CONTRACT_MANAGE");
  const editable = canManage && ["DRAFT", "REJECTED"].includes(contract.status);
  const options = canManage && ["SIGNED", "ACTIVE"].includes(contract.status) && !project
    ? await contractOptions()
    : { sources: [], managers: [] };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeading
        eyebrow={contract.contract_number}
        title={contract.contract_name}
        description={`${contract.customer?.name ?? "고객사 정보 없음"} · ${contract.start_date} ~ ${contract.end_date}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["상태", contractStatusLabels[contract.status] ?? contract.status],
          ["공급가액", `${money.format(contract.supply_amount)}원`],
          ["VAT", `${money.format(contract.vat_amount)}원`],
          ["총 계약금액", `${money.format(contract.total_amount)}원`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>계약 정보</CardTitle></CardHeader>
            <CardContent>
              {editable ? (
                <CommandForm
                  endpoint="/api/contract"
                  action="contract.save"
                  constants={{ id: contract.id, version: contract.version }}
                  fields={[
                    ...contractFields(
                      {
                        contractDate: contract.contract_date,
                        startDate: contract.start_date,
                        endDate: contract.end_date,
                        supplyAmount: contract.supply_amount,
                        vatRate: contract.vat_rate,
                      },
                      contract,
                    ),
                    { name: "change_reason", label: "변경 사유", type: "textarea" },
                  ]}
                  submit="계약 초안 저장"
                />
              ) : (
                <dl className="grid gap-5 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">계약일</dt><dd className="mt-1 font-medium">{contract.contract_date}</dd></div>
                  <div><dt className="text-muted-foreground">발주번호</dt><dd className="mt-1 font-medium">{contract.purchase_order_number || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">계약기간</dt><dd className="mt-1 font-medium">{contract.start_date} ~ {contract.end_date}</dd></div>
                  <div><dt className="text-muted-foreground">서명일</dt><dd className="mt-1 font-medium">{contract.signed_date ?? "—"}</dd></div>
                  <div><dt className="text-muted-foreground">지급 조건</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{contract.payment_terms || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">하자보증 조건</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{contract.warranty_terms || "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">비고</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{contract.note || "—"}</dd></div>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>계약 변경 이력</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {amendments.map((amendment) => (
                <div key={amendment.id} className="flex items-start justify-between gap-4 rounded-md border p-4 text-sm">
                  <div><p className="font-semibold">변경 #{amendment.amendment_no}</p><p className="mt-1 text-muted-foreground">{amendment.reason}</p></div>
                  <time className="shrink-0 text-xs text-muted-foreground">{new Date(amendment.created_at).toLocaleString("ko-KR")}</time>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>연결 정보</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {contract.customer && <Link href={`/customers/${contract.customer.id}`} className="block text-primary hover:underline">고객사 · {contract.customer.name}</Link>}
              {contract.opportunity && <Link href={`/opportunities/${contract.opportunity.id}`} className="block text-primary hover:underline">영업기회 · {contract.opportunity.opportunity_code}</Link>}
              {contract.quotation_revision && <Link href={`/quotations/${contract.quotation_revision.quotation_id}`} className="block text-primary hover:underline">승인 견적 · V{contract.quotation_revision.revision_no}</Link>}
              {project && <Link href={`/projects/${project.id}`} className="block text-primary hover:underline">프로젝트 · {project.project_code}</Link>}
              <Badge variant="outline">{contractStatusLabels[contract.status] ?? contract.status}</Badge>
            </CardContent>
          </Card>

          {editable && (
            <Card>
              <CardHeader><CardTitle>내부 승인</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">계약 내용을 확정한 뒤 결재자에게 승인을 요청합니다.</p>
                <CommandForm endpoint="/api/contract" action="contract.submit" constants={{ id: contract.id, version: contract.version }} submit="계약 승인 요청" columns={1} />
              </CardContent>
            </Card>
          )}

          {canManage && contract.status === "APPROVED" && (
            <Card>
              <CardHeader><CardTitle>계약 서명 확정</CardTitle></CardHeader>
              <CardContent>
                <CommandForm
                  endpoint="/api/contract"
                  action="contract.sign"
                  constants={{ id: contract.id, version: contract.version }}
                  fields={[{ name: "signed_date", label: "서명일", type: "date", value: today, required: true }]}
                  submit="서명 완료 처리"
                  columns={1}
                />
              </CardContent>
            </Card>
          )}

          {canManage && ["SIGNED", "ACTIVE"].includes(contract.status) && !project && (
            <Card>
              <CardHeader><CardTitle>프로젝트 전환</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">서명된 계약의 고객사, 영업기회, 견적과 계약기간을 프로젝트에 승계합니다.</p>
                <CommandForm
                  endpoint="/api/contract"
                  action="contract.create_project"
                  constants={{ id: contract.id }}
                  fields={[
                    { name: "project_code", label: "프로젝트 코드", required: true, minLength: 3 },
                    { name: "project_manager_id", label: "프로젝트 매니저", type: "select", required: true, options: options.managers.map((manager) => ({ value: manager.id, label: manager.name })) },
                    { name: "description", label: "프로젝트 설명", type: "textarea" },
                  ]}
                  submit="프로젝트 생성"
                  columns={1}
                />
              </CardContent>
            </Card>
          )}

          {project && (
            <Card>
              <CardHeader><CardTitle>생성된 프로젝트</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <Link href={`/projects/${project.id}`} className="font-semibold text-primary hover:underline">{project.project_code} · {project.project_name}</Link>
                <p className="mt-2 text-muted-foreground">상태 · {project.status}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
