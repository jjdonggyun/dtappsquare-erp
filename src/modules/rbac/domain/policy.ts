import type { Account } from "@/modules/users/domain/contracts";
import { AppError } from "@/shared/domain/errors";
export function authorize(
  account: Account | null,
  permission?: string,
): asserts account is Account {
  if (!account) throw new AppError("Unauthorized");
  if (account.status !== "ACTIVE" || (permission && !account.permissions.includes(permission)))
    throw new AppError("Forbidden");
}
export function authorizeAny(account: Account | null, permissions: string[]): asserts account is Account {
  authorize(account);
  if (!permissions.some((permission) => account.permissions.includes(permission)))
    throw new AppError("Forbidden");
}
export const navigation = [
  { href: "/dashboard", label: "대시보드", permissions: ["PROFILE_READ_SELF"] },
  { href: "/attendance", label: "내 근태", permissions: ["ATTENDANCE_READ_SELF"] },
  { href: "/leave", label: "휴가", permissions: ["LEAVE_REQUEST"] },
  { href: "/approvals", label: "결재함", permissions: ["APPROVAL_READ_SELF"] },
  { href: "/notifications", label: "알림", permissions: ["NOTIFICATION_READ_SELF"] },
  { href: "/assets", label: "내 자산", permissions: ["ASSET_READ_SELF"] },
  { href: "/projects", label: "내 프로젝트", permissions: ["PROJECT_READ_SELF"] },
  { href: "/work-logs", label: "업무일지", permissions: ["WORK_LOG_READ_SELF"] },
  { href: "/weekly-reports", label: "주간보고", permissions: ["WEEKLY_REPORT_READ_SELF"] },
  { href: "/expenses", label: "법인카드 사용내역", permissions: ["EXPENSE_READ_SELF", "EXPENSE_READ_ALL"] },
  { href: "/profile", label: "내 프로필", permissions: ["PROFILE_READ_SELF"] },
  { href: "/workforce-profiles/me", label: "내 인력프로필", permissions: ["WORKFORCE_PROFILE_READ_SELF"] },
  { href: "/organizations", label: "조직도", permissions: ["PROFILE_READ_SELF"] },
  { href: "/admin/requests", label: "가입 승인", permissions: ["USER_APPROVE"] },
  { href: "/admin/users", label: "직원관리", permissions: ["USER_READ"] },
  { href: "/admin/organizations", label: "조직관리", permissions: ["ORGANIZATION_MANAGE"] },
  {
    href: "/admin/attendance",
    label: "근태관리",
    permissions: ["ATTENDANCE_READ_TEAM", "ATTENDANCE_MANAGE"],
  },
  { href: "/admin/attendance-verification", label: "출퇴근 검증", permissions: ["ATTENDANCE_VERIFICATION_READ"] },
  { href: "/admin/work-policies", label: "근무정책", permissions: ["WORK_POLICY_MANAGE"] },
  { href: "/admin/leave", label: "휴가관리", permissions: ["LEAVE_MANAGE"] },
  { href: "/admin/approvals", label: "결재관리", permissions: ["APPROVAL_MANAGE"] },
  { href: "/admin/assets", label: "자산관리", permissions: ["ASSET_READ", "ASSET_WRITE"] },
  { href: "/admin/devices", label: "장치관리", permissions: ["DEVICE_MANAGE"] },
  { href: "/admin/projects", label: "프로젝트 대시보드", permissions: ["PROJECT_READ", "PROJECT_READ_ALL"] },
  { href: "/admin/resources", label: "리소스 계획", permissions: ["RESOURCE_READ"] },
  { href: "/admin/workforce-profiles", label: "인력 기술 현황", permissions: ["WORKFORCE_PROFILE_READ_TEAM", "WORKFORCE_PROFILE_READ_ALL"] },
  { href: "/admin/corporate-cards", label: "법인카드 관리", permissions: ["CORPORATE_CARD_READ", "CORPORATE_CARD_MANAGE"] },
  { href: "/admin/card-settlements", label: "월 정산", permissions: ["CARD_SETTLEMENT_READ"] },
  { href: "/admin/roles", label: "역할관리", permissions: ["RBAC_MANAGE"] },
  { href: "/admin/settings", label: "시스템 설정", permissions: ["RBAC_MANAGE"] },
  { href: "/admin/audit", label: "감사 로그", permissions: ["AUDIT_READ"] },
] as const;
