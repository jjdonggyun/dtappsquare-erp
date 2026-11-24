import { PageHeading } from "@/components/page-heading";
import { ExpenseLedger } from "@/components/expense-ledger";
import { requireAnyPage } from "@/shared/auth/account";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { expenseFinanceCatalogs, expenseLedger } from "@/modules/expense-finance/infrastructure/repository";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const account = await requireAnyPage(["EXPENSE_READ_SELF", "EXPENSE_READ_PROJECT", "EXPENSE_READ_ALL", "EXPENSE_MANAGE"]);
  const query = await searchParams;
  const [catalogs, rows] = await Promise.all([expenseFinanceCatalogs(), expenseLedger(query.project)]);
  return <><PageHeading eyebrow="EXPENSE LEDGER" title="통합 비용 원장" description="법인카드, 계좌이체, 현금, 세금계산서 비용을 프로젝트별로 승인·지급까지 관리합니다." />
    <ExpenseLedger expenses={rows} types={catalogs.types} vendors={catalogs.vendors} projects={catalogs.projects} cards={catalogs.cards} assignments={catalogs.assignments} accountId={account.id}
      canWrite={account.permissions.includes("EXPENSE_WRITE_SELF") || account.permissions.includes("EXPENSE_MANAGE")} canManage={account.permissions.includes("EXPENSE_MANAGE")}
      today={dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE)} />
  </>;
}
