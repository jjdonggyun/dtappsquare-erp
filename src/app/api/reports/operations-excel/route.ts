import { z } from "zod";
import { currentAccount } from "@/shared/auth/account";
import { authorizeAny } from "@/modules/rbac/domain/policy";
import { failure } from "@/shared/infrastructure/http";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { opportunityReportList } from "@/modules/sales/infrastructure/repository";
import { quotationReportList } from "@/modules/quotation/infrastructure/repository";
import { billingList, billingScheduleList, paymentList } from "@/modules/finance/infrastructure/repository";
import { projectFinancialPortfolio } from "@/modules/expense-finance/infrastructure/repository";
import { buildOperationsReportExcel } from "@/modules/reporting/application/operations-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportPermissions = [
  "OPPORTUNITY_READ_ALL", "QUOTATION_READ_ALL", "QUOTATION_MANAGE",
  "BILLING_READ_ALL", "BILLING_MANAGE", "PAYMENT_READ_ALL", "PAYMENT_MANAGE",
  "PROJECT_FINANCE_READ_ALL",
];

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const account = await currentAccount();
    authorizeAny(account, reportPermissions);
    const today = dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE);
    const asOf = z.iso.date().parse(new URL(request.url).searchParams.get("asOf") ?? today);
    const can = (permissions: string[]) => permissions.some((permission) => account.permissions.includes(permission));
    const [opportunities, quotations, billingSchedules, billings, payments, profitability] = await Promise.all([
      can(["OPPORTUNITY_READ_ALL"]) ? opportunityReportList() : undefined,
      can(["QUOTATION_READ_ALL", "QUOTATION_MANAGE"]) ? quotationReportList() : undefined,
      can(["BILLING_READ_ALL", "BILLING_MANAGE"]) ? billingScheduleList() : undefined,
      can(["BILLING_READ_ALL", "BILLING_MANAGE"]) ? billingList() : undefined,
      can(["PAYMENT_READ_ALL", "PAYMENT_MANAGE"]) ? paymentList() : undefined,
      can(["PROJECT_FINANCE_READ_ALL"]) ? projectFinancialPortfolio(asOf) : undefined,
    ]);
    const buffer = await buildOperationsReportExcel({
      asOf,
      generatedAt: new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: environment().COMPANY_TIMEZONE }).format(new Date()),
      generatedBy: account.name,
      opportunities, quotations, billingSchedules, billings, payments, profitability,
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="DigitalSquare_Operations_${asOf}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error, requestId);
  }
}
