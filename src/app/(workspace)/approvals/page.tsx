import { requirePage } from "@/shared/auth/account";
import { approvalInbox } from "@/modules/approval/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { ApprovalList } from "@/components/approval-list";

export default async function ApprovalsPage() {
  const account = await requirePage("APPROVAL_READ_SELF");
  const rows = await approvalInbox();
  const waiting = rows.filter((row) => row.status === "PENDING" && row.steps.some((step) => step.step_order === row.current_step_order && step.approver_id === account.id));
  return <><PageHeading eyebrow="APPROVAL" title="결재함" description={`내가 요청했거나 결재자로 지정된 문서를 확인합니다. 현재 처리할 결재 ${waiting.length}건입니다.`}/><ApprovalList rows={rows} accountId={account.id}/></>;
}
