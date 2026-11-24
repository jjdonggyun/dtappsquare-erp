import Link from "next/link";
import { requireAnyPage } from "@/shared/auth/account";

export default async function ProjectHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const account = await requireAnyPage(["PROJECT_READ_SELF", "PROJECT_READ", "PROJECT_READ_ALL"]);
  const { id } = await params;
  const links = [
    { href: `/projects/${id}`, label: "프로젝트 개요", visible: true },
    {
      href: `/projects/${id}?tab=work`,
      label: "업무일지",
      visible: account.permissions.some((permission) =>
        ["WORK_LOG_READ_SELF", "WORK_LOG_READ_PROJECT", "WORK_LOG_READ_ALL"].includes(permission),
      ),
    },
    {
      href: `/projects/${id}/reports`,
      label: "주간보고",
      visible: account.permissions.some((permission) =>
        ["WEEKLY_REPORT_READ_SELF", "WEEKLY_REPORT_READ_TEAM", "WEEKLY_REPORT_READ_ALL"].includes(
          permission,
        ),
      ),
    },
    {
      href: `/projects/${id}?tab=expense`,
      label: "비용",
      visible:
        account.permissions.includes("EXPENSE_READ_PROJECT") ||
        account.permissions.includes("EXPENSE_READ_ALL"),
    },
    {
      href: `/projects/${id}/resources`,
      label: "MM · 단가",
      visible:
        account.permissions.includes("PROJECT_RATE_READ") ||
        account.permissions.includes("PROJECT_RATE_MANAGE"),
    },
    {
      href: `/projects/${id}/documents`,
      label: "문서",
      visible:
        account.permissions.includes("PROJECT_DOCUMENT_READ") ||
        account.permissions.includes("PROJECT_DOCUMENT_MANAGE"),
    },
    {
      href: `/projects/${id}/inspections`,
      label: "검수",
      visible:
        account.permissions.includes("PROJECT_INSPECTION_READ") ||
        account.permissions.includes("PROJECT_INSPECTION_MANAGE"),
    },
    {
      href: `/projects/${id}/pnl`,
      label: "손익",
      visible:
        account.permissions.includes("PROJECT_FINANCE_READ") ||
        account.permissions.includes("PROJECT_FINANCE_READ_ALL"),
    },
    {
      href: `/projects/${id}/closing`,
      label: "마감",
      visible:
        account.permissions.includes("PROJECT_CLOSE") ||
        account.permissions.includes("PROJECT_REOPEN") ||
        account.permissions.includes("PROJECT_FINANCE_READ") ||
        account.permissions.includes("PROJECT_FINANCE_READ_ALL"),
    },
  ];
  return (
    <>
      <nav
        aria-label="프로젝트 허브"
        className="mb-5 flex flex-wrap gap-2 rounded-md border bg-card p-2"
      >
        {links
          .filter((link) => link.visible)
          .map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
      </nav>
      {children}
    </>
  );
}
