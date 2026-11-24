import { currentAccount } from "@/shared/auth/account";
import { authorizeAny } from "@/modules/rbac/domain/policy";
import { AppError } from "@/shared/domain/errors";
import { failure } from "@/shared/infrastructure/http";
import { taxInvoiceDetail } from "@/modules/finance/infrastructure/repository";
import { createTaxInvoicePdf } from "@/modules/finance/application/tax-invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const account = await currentAccount(); authorizeAny(account, ["TAX_INVOICE_READ","TAX_INVOICE_READ_ALL","TAX_INVOICE_MANAGE"]);
    const id = new URL(request.url).searchParams.get("id"); if (!id) throw new AppError("ValidationError");
    const invoice = await taxInvoiceDetail(id); if (!invoice) throw new AppError("NotFound");
    const pdf = await createTaxInvoicePdf(invoice);
    const filename = `${invoice.invoice_number}-${invoice.status === "ISSUED" ? "issued" : "draft"}.pdf`;
    return new Response(new Uint8Array(pdf), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return failure(error, requestId); }
}
