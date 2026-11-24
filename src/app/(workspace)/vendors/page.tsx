import { PageHeading } from "@/components/page-heading";
import { ExpenseMasterManager } from "@/components/expense-master-manager";
import { requireAnyPage } from "@/shared/auth/account";
import { expenseFinanceCatalogs } from "@/modules/expense-finance/infrastructure/repository";

export default async function VendorsPage() {
  await requireAnyPage(["EXPENSE_MASTER_MANAGE", "EXPENSE_MANAGE"]);
  const catalogs = await expenseFinanceCatalogs();
  return <><PageHeading eyebrow="EXPENSE MASTER" title="거래처 · 비용 유형" description="프로젝트 비용에 사용하는 거래처, 외주처, 계정 유형과 부가세 공제 기준을 관리합니다." />
    <ExpenseMasterManager types={catalogs.types} vendors={catalogs.vendors} />
  </>;
}
