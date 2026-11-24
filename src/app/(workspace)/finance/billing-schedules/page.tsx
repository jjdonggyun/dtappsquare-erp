import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { scheduleStatusLabels } from "@/modules/finance/domain/finance";
import { billingScheduleList, financeOptions } from "@/modules/finance/infrastructure/repository";
import { requireAnyPage } from "@/shared/auth/account";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export default async function BillingSchedulesPage() {
  const account = await requireAnyPage(["BILLING_READ", "BILLING_READ_ALL", "BILLING_MANAGE"]);
  const canManage = account.permissions.includes("BILLING_MANAGE");
  const [rows, options] = await Promise.all([billingScheduleList(), canManage ? financeOptions() : Promise.resolve({ projects: [], contracts: [], customers: [], banks: [] })]);
  const today = new Date().toISOString().slice(0, 10);
  const projectOptions = options.projects.flatMap((project) => {
    const contract = options.contracts.find((item) => item.id === project.contract_id);
    return contract ? [{ value: `${project.id}|${contract.id}`, label: `${project.project_code} · ${project.project_name} / ${contract.contract_number}` }] : [];
  });
  return <><PageHeading eyebrow="BILLING PLAN" title="청구 일정" description="계약의 착수금·중도금·잔금 일정을 관리하고 청구서 초안으로 전환합니다." />
    <div className={`grid items-start gap-6 ${canManage ? "xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]" : ""}`}>
      <Card><CardHeader><CardTitle>청구 일정표</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow>{["예정일","프로젝트 / 계약","차수","청구명","공급가액","세액","합계","상태","작업"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.scheduled_date}</TableCell><TableCell><p className="font-medium">{row.project?.project_name ?? "—"}</p><p className="text-xs text-muted-foreground">{row.contract?.contract_number}</p></TableCell><TableCell>{row.sequence_no}</TableCell><TableCell>{row.title}</TableCell><TableCell>{money.format(row.supply_amount)}원</TableCell><TableCell>{money.format(row.vat_amount)}원</TableCell><TableCell className="font-semibold">{money.format(row.total_amount)}원</TableCell><TableCell><Badge variant="outline">{scheduleStatusLabels[row.status] ?? row.status}</Badge></TableCell><TableCell>{canManage && ["SCHEDULED","READY"].includes(row.status) ? <CommandForm endpoint="/api/project-finance" action="billing.create" constants={{ schedule_id: row.id, bank_account_id: options.banks[0]?.id }} fields={[{ name: "billing_date", label: "청구일", type: "date", value: today, required: true },{ name: "due_date", label: "입금기한", type: "date", value: row.scheduled_date < today ? today : row.scheduled_date, required: true }]} submit="청구서 생성" columns={1} /> : "—"}</TableCell></TableRow>)}</TableBody></Table>{!rows.length && <p className="py-12 text-center text-sm text-muted-foreground">등록된 청구 일정이 없습니다.</p>}</CardContent></Card>
      {canManage && <Card><CardHeader><CardTitle>청구 일정 등록</CardTitle></CardHeader><CardContent>{projectOptions.length ? <ProjectScheduleForm options={projectOptions} today={today} /> : <p className="text-sm text-muted-foreground">서명된 계약에서 생성한 프로젝트가 필요합니다.</p>}</CardContent></Card>}
    </div></>;
}

function ProjectScheduleForm({ options, today }: { options: { value: string; label: string }[]; today: string }) {
  return <CommandForm endpoint="/api/project-finance" action="schedule.save" columns={1} fields={[
    { name: "project_contract", label: "프로젝트 / 연결 계약", type: "select", value: options[0]?.value, options, compoundNames: ["project_id", "contract_id"], required: true },
    { name: "sequence_no", label: "청구 차수", type: "number", value: 1, min: 1, required: true }, { name: "title", label: "청구명", value: "1차 청구", required: true },
    { name: "billing_condition", label: "청구 조건", type: "textarea" }, { name: "scheduled_date", label: "예정일", type: "date", value: today, required: true },
    { name: "supply_amount", label: "공급가액", type: "number", value: 0, min: 0, step: 1, required: true }, { name: "vat_rate", label: "VAT(%)", type: "number", value: 10, min: 0, max: 100, step: 0.01, required: true },
    { name: "note", label: "비고", type: "textarea" },
  ]} submit="일정 등록" />;
}
