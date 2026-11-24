export const navigationSectionIds = [
  "workspace",
  "work",
  "sales",
  "finance",
  "organization",
  "attendance",
  "asset",
  "project",
  "expense",
  "system",
] as const;

export type NavigationSectionId = (typeof navigationSectionIds)[number];

export type NavigationIcon =
  | "dashboard"
  | "attendance"
  | "leave"
  | "approval"
  | "notification"
  | "asset"
  | "project"
  | "workLog"
  | "report"
  | "expense"
  | "vendor"
  | "customer"
  | "opportunity"
  | "quotation"
  | "contract"
  | "billingSchedule"
  | "billing"
  | "taxInvoice"
  | "payment"
  | "profit"
  | "settings"
  | "profile"
  | "organization"
  | "request"
  | "users"
  | "verification"
  | "device"
  | "card"
  | "audit";

export type NavigationItem = {
  id: string;
  href: string;
  label: string;
  section: NavigationSectionId;
  icon: NavigationIcon;
  permissions: readonly string[];
  keywords?: readonly string[];
};

export type QuickAction = {
  id: string;
  href: string;
  label: string;
  description: string;
  permissions: readonly string[];
};

export const navigationSections = [
  { id: "workspace", label: "내 워크스페이스" },
  { id: "work", label: "업무관리" },
  { id: "sales", label: "영업" },
  { id: "finance", label: "재무 · 청구" },
  { id: "organization", label: "조직 · 인사" },
  { id: "attendance", label: "근태 · 결재" },
  { id: "asset", label: "자산 · 장치" },
  { id: "project", label: "프로젝트 관리" },
  { id: "expense", label: "법인카드 · 비용" },
  { id: "system", label: "시스템" },
] as const satisfies readonly { id: NavigationSectionId; label: string }[];

export const navigation = [
  { id: "dashboard", href: "/dashboard", label: "대시보드", section: "workspace", icon: "dashboard", permissions: ["PROFILE_READ_SELF"] },
  { id: "attendance-self", href: "/attendance", label: "내 근태", section: "workspace", icon: "attendance", permissions: ["ATTENDANCE_READ_SELF"] },
  { id: "leave-self", href: "/leave", label: "휴가", section: "workspace", icon: "leave", permissions: ["LEAVE_REQUEST"] },
  { id: "approvals-self", href: "/approvals", label: "결재함", section: "workspace", icon: "approval", permissions: ["APPROVAL_READ_SELF"] },
  { id: "notifications", href: "/notifications", label: "알림", section: "workspace", icon: "notification", permissions: ["NOTIFICATION_READ_SELF"] },
  { id: "assets-self", href: "/assets", label: "내 자산", section: "workspace", icon: "asset", permissions: ["ASSET_READ_SELF"] },
  { id: "profile", href: "/profile", label: "내 프로필", section: "workspace", icon: "profile", permissions: ["PROFILE_READ_SELF"] },
  { id: "workforce-profile-self", href: "/workforce-profiles/me", label: "내 인력프로필", section: "workspace", icon: "profile", permissions: ["WORKFORCE_PROFILE_READ_SELF"] },
  { id: "work-logs", href: "/work-logs", label: "업무일지", section: "work", icon: "workLog", permissions: ["WORK_LOG_READ_SELF"] },
  { id: "weekly-reports", href: "/weekly-reports", label: "주간보고", section: "work", icon: "report", permissions: ["WEEKLY_REPORT_READ_SELF"] },
  { id: "customers", href: "/customers", label: "고객사", section: "sales", icon: "customer", permissions: ["CUSTOMER_READ", "CUSTOMER_MANAGE"] },
  { id: "opportunities", href: "/opportunities", label: "영업기회", section: "sales", icon: "opportunity", permissions: ["OPPORTUNITY_READ", "OPPORTUNITY_READ_ALL", "OPPORTUNITY_MANAGE"] },
  { id: "quotations", href: "/quotations", label: "견적", section: "sales", icon: "quotation", permissions: ["QUOTATION_READ", "QUOTATION_READ_ALL", "QUOTATION_MANAGE", "QUOTATION_APPROVE"] },
  { id: "contracts", href: "/contracts", label: "계약 · 발주", section: "sales", icon: "contract", permissions: ["CONTRACT_READ", "CONTRACT_READ_ALL", "CONTRACT_MANAGE", "CONTRACT_APPROVE"] },
  { id: "billing-schedules", href: "/finance/billing-schedules", label: "청구 일정", section: "finance", icon: "billingSchedule", permissions: ["BILLING_READ", "BILLING_READ_ALL", "BILLING_MANAGE"] },
  { id: "billings", href: "/finance/billings", label: "청구 · 미수금", section: "finance", icon: "billing", permissions: ["BILLING_READ", "BILLING_READ_ALL", "BILLING_MANAGE"] },
  { id: "tax-invoices", href: "/finance/tax-invoices", label: "세금계산서", section: "finance", icon: "taxInvoice", permissions: ["TAX_INVOICE_READ", "TAX_INVOICE_READ_ALL", "TAX_INVOICE_MANAGE"] },
  { id: "payments", href: "/finance/payments", label: "입금 · 수금배분", section: "finance", icon: "payment", permissions: ["PAYMENT_READ", "PAYMENT_READ_ALL", "PAYMENT_MANAGE"] },
  { id: "project-pnl", href: "/finance/project-pnl", label: "프로젝트 손익", section: "finance", icon: "profit", permissions: ["PROJECT_FINANCE_READ", "PROJECT_FINANCE_READ_ALL"] },
  { id: "operations-reports", href: "/reports", label: "통합 보고서", section: "finance", icon: "report", permissions: ["OPPORTUNITY_READ_ALL", "QUOTATION_READ_ALL", "QUOTATION_MANAGE", "BILLING_READ_ALL", "BILLING_MANAGE", "PAYMENT_READ_ALL", "PAYMENT_MANAGE", "PROJECT_FINANCE_READ_ALL"] },
  { id: "finance-settings", href: "/finance/settings", label: "재무 설정", section: "finance", icon: "settings", permissions: ["FINANCE_SETTINGS_MANAGE"] },
  { id: "organization-chart", href: "/organizations", label: "조직도", section: "organization", icon: "organization", permissions: ["ORGANIZATION_READ"] },
  { id: "signup-requests", href: "/admin/requests", label: "가입 승인", section: "organization", icon: "request", permissions: ["USER_APPROVE"] },
  { id: "users", href: "/admin/users", label: "직원관리", section: "organization", icon: "users", permissions: ["USER_READ", "USER_READ_TEAM"] },
  { id: "organizations", href: "/admin/organizations", label: "조직관리", section: "organization", icon: "organization", permissions: ["ORGANIZATION_MANAGE"] },
  { id: "attendance-admin", href: "/admin/attendance", label: "근태관리", section: "attendance", icon: "attendance", permissions: ["ATTENDANCE_READ_TEAM", "ATTENDANCE_MANAGE"] },
  { id: "attendance-verification", href: "/admin/attendance-verification", label: "출퇴근 검증", section: "attendance", icon: "verification", permissions: ["ATTENDANCE_VERIFICATION_READ"] },
  { id: "work-policies", href: "/admin/work-policies", label: "근무정책", section: "attendance", icon: "settings", permissions: ["WORK_POLICY_MANAGE"] },
  { id: "leave-admin", href: "/admin/leave", label: "휴가관리", section: "attendance", icon: "leave", permissions: ["LEAVE_MANAGE"] },
  { id: "approvals-admin", href: "/admin/approvals", label: "결재관리", section: "attendance", icon: "approval", permissions: ["APPROVAL_MANAGE"] },
  { id: "assets-admin", href: "/admin/assets", label: "자산관리", section: "asset", icon: "asset", permissions: ["ASSET_READ", "ASSET_WRITE"] },
  { id: "devices", href: "/admin/devices", label: "장치관리", section: "asset", icon: "device", permissions: ["DEVICE_MANAGE"] },
  { id: "projects", href: "/projects", label: "프로젝트", section: "project", icon: "project", permissions: ["PROJECT_READ_SELF", "PROJECT_READ", "PROJECT_READ_ALL"] },
  { id: "resources", href: "/admin/resources", label: "리소스 계획", section: "project", icon: "profit", permissions: ["RESOURCE_READ"] },
  { id: "workforce-profiles", href: "/admin/workforce-profiles", label: "인력 기술 현황", section: "project", icon: "users", permissions: ["WORKFORCE_PROFILE_READ_TEAM", "WORKFORCE_PROFILE_READ_ALL"] },
  { id: "expenses", href: "/expenses", label: "통합 비용 원장", section: "expense", icon: "expense", permissions: ["EXPENSE_READ_SELF", "EXPENSE_READ_PROJECT", "EXPENSE_READ_ALL", "EXPENSE_MANAGE"] },
  { id: "vendors", href: "/vendors", label: "거래처 · 비용 유형", section: "expense", icon: "vendor", permissions: ["EXPENSE_MASTER_MANAGE", "EXPENSE_MANAGE"] },
  { id: "corporate-cards", href: "/admin/corporate-cards", label: "법인카드 관리", section: "expense", icon: "card", permissions: ["CORPORATE_CARD_READ", "CORPORATE_CARD_MANAGE"] },
  { id: "card-settlements", href: "/admin/card-settlements", label: "월 정산", section: "expense", icon: "expense", permissions: ["CARD_SETTLEMENT_READ"] },
  { id: "roles", href: "/admin/roles", label: "역할관리", section: "system", icon: "verification", permissions: ["RBAC_MANAGE"] },
  { id: "settings", href: "/admin/settings", label: "시스템 설정", section: "system", icon: "settings", permissions: ["RBAC_MANAGE"] },
  { id: "audit", href: "/admin/audit", label: "감사 로그", section: "system", icon: "audit", permissions: ["AUDIT_READ"] },
] as const satisfies readonly NavigationItem[];

export const quickActions = [
  { id: "write-work-log", href: "/work-logs#new", label: "업무일지 작성", description: "오늘의 업무와 투입 시간을 기록합니다.", permissions: ["WORK_LOG_WRITE_SELF"] },
  { id: "request-leave", href: "/leave#request", label: "휴가 신청", description: "휴가 신청서를 작성합니다.", permissions: ["LEAVE_REQUEST"] },
  { id: "register-expense", href: "/expenses#new", label: "비용 등록", description: "법인카드·개인 비용을 등록합니다.", permissions: ["EXPENSE_WRITE_SELF", "EXPENSE_MANAGE"] },
  { id: "create-customer", href: "/customers#new", label: "고객사 등록", description: "신규 고객사 기본정보를 등록합니다.", permissions: ["CUSTOMER_MANAGE"] },
  { id: "create-opportunity", href: "/opportunities#new", label: "영업기회 등록", description: "파이프라인에 영업기회를 추가합니다.", permissions: ["OPPORTUNITY_MANAGE"] },
  { id: "create-quotation", href: "/quotations#new", label: "견적 작성", description: "영업기회 기준 견적을 작성합니다.", permissions: ["QUOTATION_MANAGE"] },
  { id: "create-billing", href: "/finance/billings#new", label: "청구 등록", description: "청구 및 세금계산서 발행을 시작합니다.", permissions: ["BILLING_MANAGE"] },
  { id: "record-payment", href: "/finance/payments#new", label: "입금 등록", description: "수금 내역과 청구 배분을 등록합니다.", permissions: ["PAYMENT_MANAGE"] },
] as const satisfies readonly QuickAction[];

export function canAccess(required: readonly string[], permissions: readonly string[]) {
  return required.some((permission) => permissions.includes(permission));
}

export function visibleNavigation(permissions: readonly string[]) {
  return navigation.filter((item) => canAccess(item.permissions, permissions));
}

export function visibleQuickActions(permissions: readonly string[]) {
  return quickActions.filter((item) => canAccess(item.permissions, permissions));
}

export function activeNavigation(pathname: string) {
  return [...navigation]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

const detailLabels: Record<string, string> = {
  resources: "리소스",
  documents: "문서",
  inspections: "검수",
  reports: "보고",
  pnl: "손익",
  closing: "마감",
};

export type BreadcrumbItem = { label: string; href?: string };

export function breadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  if (pathname === "/search") return [{ label: "통합 검색" }];
  const item = activeNavigation(pathname);
  if (!item) return [{ label: "상세 화면" }];
  const section = navigationSections.find((candidate) => candidate.id === item.section);
  const crumbs: BreadcrumbItem[] = section ? [{ label: section.label }] : [];
  if (pathname === item.href) return [...crumbs, { label: item.label }];
  const remainder = pathname.slice(item.href.length).split("/").filter(Boolean);
  crumbs.push({ label: item.label, href: item.href });
  if (remainder.length === 1) crumbs.push({ label: "상세" });
  else if (remainder.length > 1) crumbs.push({ label: detailLabels[remainder.at(-1) ?? ""] ?? "상세" });
  return crumbs;
}

export function notificationActionPath(referenceType: string, referenceId: string) {
  const routes: Record<string, string> = {
    LEAVE_REQUEST: "/leave",
    APPROVAL_REQUEST: "/approvals",
    QUOTATION: `/quotations/${referenceId}`,
    CONTRACT: `/contracts/${referenceId}`,
    PROJECT: `/projects/${referenceId}`,
    PROJECT_DOCUMENT: `/projects/${referenceId}/documents`,
    PROJECT_INSPECTION: `/projects/${referenceId}/inspections`,
    BILLING: `/finance/billings/${referenceId}`,
    BILLING_SCHEDULE: "/finance/billing-schedules",
    TAX_INVOICE: `/finance/tax-invoices/${referenceId}`,
    PAYMENT: "/finance/payments",
    EXPENSE: "/expenses",
    ASSET_ASSIGNMENT: "/assets",
    PROJECT_ASSIGNMENT: "/projects",
    EMPLOYEE: "/profile",
    CORPORATE_CARD_REPORT: "/admin/card-settlements",
  };
  return routes[referenceType] ?? null;
}
