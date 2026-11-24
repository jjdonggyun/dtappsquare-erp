import { currentAccount } from "@/shared/auth/account";
import { authorizeAny } from "@/modules/rbac/domain/policy";
import { AppError } from "@/shared/domain/errors";
import { failure } from "@/shared/infrastructure/http";
import { quotationDetail } from "@/modules/quotation/infrastructure/repository";
import { financeSettings } from "@/modules/finance/infrastructure/repository";
import { createQuotationPdf } from "@/modules/quotation/application/quotation-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    authorizeAny(await currentAccount(), ["QUOTATION_READ", "QUOTATION_READ_ALL", "QUOTATION_MANAGE", "QUOTATION_APPROVE"]);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new AppError("ValidationError");
    const [detail, settings] = await Promise.all([quotationDetail(id), financeSettings()]);
    if (!detail) throw new AppError("NotFound");
    const pdf = await createQuotationPdf(detail, settings.profile);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${detail.quote.quotation_number}-V${detail.quote.current_revision?.revision_no ?? 1}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error, requestId);
  }
}
