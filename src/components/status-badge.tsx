import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
  ARCHIVED: "보관",
  DRAFT: "작성 중",
  SUBMITTED: "제출",
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
  READY: "발행 준비",
  ISSUED: "발행",
  BILLED: "청구",
  PARTIALLY_PAID: "부분 수금",
  PAID: "수금 완료",
  CONFIRMED: "확정",
  SIGNED: "서명 완료",
  PLANNING: "계획",
  SCHEDULED: "예정",
  IN_PROGRESS: "진행 중",
  ON_HOLD: "보류",
  COMPLETED: "완료",
  CANCELED: "취소",
  TERMINATED: "종료",
  LEAD: "리드",
  PROPOSAL: "제안",
  QUOTATION: "견적",
  NEGOTIATION: "협상",
  WON: "수주",
  LOST: "실주",
  REQUESTED: "승인 대기",
};

const success = new Set(["ACTIVE", "APPROVED", "ISSUED", "PAID", "CONFIRMED", "SIGNED", "COMPLETED", "WON"]);
const warning = new Set(["SUBMITTED", "PENDING", "READY", "BILLED", "PARTIALLY_PAID", "IN_PROGRESS", "PROPOSAL", "QUOTATION", "NEGOTIATION", "REQUESTED"]);
const danger = new Set(["REJECTED", "CANCELED", "TERMINATED", "LOST"]);
const muted = new Set(["INACTIVE", "ARCHIVED", "DRAFT", "PLANNING", "SCHEDULED", "ON_HOLD", "LEAD"]);

export function statusLabel(status: string) {
  return labels[status] ?? status.replaceAll("_", " ");
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        success.has(status) && "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning.has(status) && "border-amber-200 bg-amber-50 text-amber-700",
        danger.has(status) && "border-red-200 bg-red-50 text-red-700",
        muted.has(status) && "border-slate-200 bg-slate-50 text-slate-600",
        className,
      )}
    >
      {statusLabel(status)}
    </Badge>
  );
}
