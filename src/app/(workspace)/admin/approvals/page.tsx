import { requirePage } from "@/shared/auth/account";
import { approvalInbox } from "@/modules/approval/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { ApprovalList } from "@/components/approval-list";

export default async function ApprovalAdminPage() {
  const account = await requirePage("APPROVAL_MANAGE");
  const rows = await approvalInbox();
  return <><PageHeading eyebrow="APPROVAL OPERATIONS" title="결재관리" description="범용 결재 요청의 현재 단계와 고정된 결재 경로를 전사 범위로 조회합니다."/><ApprovalList rows={rows} accountId={account.id}/></>;
}
