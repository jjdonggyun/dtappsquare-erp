import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPage } from "@/shared/auth/account";
import { quotationDetail } from "@/modules/quotation/infrastructure/repository";
import { quotationStatusLabels } from "@/modules/quotation/domain/contracts";
import { quotationItemFields, quotationRevisionFields } from "@/components/forms/quotation-fields";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireAnyPage([
    "QUOTATION_READ",
    "QUOTATION_READ_ALL",
    "QUOTATION_MANAGE",
    "QUOTATION_APPROVE",
  ]);
  const { id } = await params;
  const detail = await quotationDetail(id);
  if (!detail) notFound();
  const { quote, revisions, items } = detail;
  const revision = quote.current_revision;
  if (!revision) notFound();
  const canManage = account.permissions.includes("QUOTATION_MANAGE");
  const editable = canManage && revision.status === "DRAFT" && quote.status === "DRAFT";
  return (
    <>
      <PageHeading
        eyebrow={quote.quotation_number}
        title={`${revision.project_name} · V${revision.revision_no}`}
        description={`${quote.customer?.name ?? "고객사 정보 없음"} · ${quote.opportunity?.title ?? "영업기회 정보 없음"}`}
      />
      <div className="mb-5 flex justify-end">
        <Button asChild variant="outline"><a href={`/api/quotation/pdf?id=${quote.id}`} target="_blank" rel="noreferrer">견적서 PDF</a></Button>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["상태", quotationStatusLabels[quote.status] ?? quote.status],
          ["공급가액", `${money.format(revision.supply_amount)}원`],
          ["VAT", `${money.format(revision.vat_amount)}원`],
          ["총 견적금액", `${money.format(revision.total_amount)}원`],
          ["예상이익", `${money.format(revision.expected_profit)}원 · ${revision.expected_profit_rate}%`],
        ].map(([label, value]) => (
          <Card key={label}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-bold">{value}</p></CardContent></Card>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>견적 Header</CardTitle></CardHeader>
            <CardContent>
              {editable ? (
                <CommandForm endpoint="/api/quotation" action="revision.save" constants={{ id: revision.id, version: revision.version }} fields={quotationRevisionFields(revision)} submit="견적 Header 저장" />
              ) : (
                <dl className="grid gap-5 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">견적일</dt><dd className="mt-1 font-medium">{revision.quotation_date}</dd></div>
                  <div><dt className="text-muted-foreground">유효기간</dt><dd className="mt-1 font-medium">{revision.valid_until}</dd></div>
                  <div><dt className="text-muted-foreground">VAT</dt><dd className="mt-1 font-medium">{revision.vat_rate}%</dd></div>
                  <div><dt className="text-muted-foreground">예상원가</dt><dd className="mt-1 font-medium">{money.format(revision.expected_cost)}원</dd></div>
                  <div className="sm:col-span-2"><dt className="text-muted-foreground">비고</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{revision.note || "—"}</dd></div>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>견적 Detail</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>{["순서", "항목 / Role", "인원", "MM", "기간", "수량", "단가", "금액"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.sort_order}</TableCell>
                      <TableCell><p className="font-medium">{item.item_name}</p><p className="text-xs text-muted-foreground">{item.role_name || "—"}</p></TableCell>
                      <TableCell>{item.headcount}명</TableCell>
                      <TableCell>{item.man_month}</TableCell>
                      <TableCell>{item.period_start ?? "—"} ~ {item.period_end ?? "—"}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{money.format(item.unit_price)}원</TableCell>
                      <TableCell>{money.format(item.amount)}원</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!items.length && <p className="py-10 text-center text-sm text-muted-foreground">견적 항목이 없습니다.</p>}
            </CardContent>
          </Card>

          {editable && items.map((item) => (
            <Card key={`edit-${item.id}`}>
              <CardHeader><CardTitle className="text-sm">항목 수정 · {item.item_name}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <CommandForm endpoint="/api/quotation" action="item.save" constants={{ id: item.id, version: item.version, revision_id: revision.id }} fields={quotationItemFields(item)} submit="항목 저장" />
                <CommandForm endpoint="/api/quotation" action="item.archive" constants={{ id: item.id, version: item.version }} submit="항목 보관" columns={1} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>연결 정보</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {quote.customer && <Link href={`/customers/${quote.customer.id}`} className="block text-primary hover:underline">고객사 · {quote.customer.name}</Link>}
              {quote.opportunity && <Link href={`/opportunities/${quote.opportunity.id}`} className="block text-primary hover:underline">영업기회 · {quote.opportunity.opportunity_code}</Link>}
              <Badge variant="outline">{quotationStatusLabels[revision.status] ?? revision.status}</Badge>
            </CardContent>
          </Card>

          {editable && (
            <Card>
              <CardHeader><CardTitle>새 견적 항목</CardTitle></CardHeader>
              <CardContent><CommandForm endpoint="/api/quotation" action="item.save" constants={{ revision_id: revision.id }} fields={quotationItemFields()} submit="항목 추가" columns={1} /></CardContent>
            </Card>
          )}

          {editable && (
            <Card>
              <CardHeader><CardTitle>내부 승인</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">항목과 금액을 확정한 뒤 제출하면 Revision이 잠기고 결재함으로 전달됩니다.</p>
                <CommandForm endpoint="/api/quotation" action="quotation.submit" constants={{ id: quote.id, revision_version: revision.version }} submit="견적 승인 요청" columns={1} />
              </CardContent>
            </Card>
          )}

          {canManage && ["DRAFT", "REJECTED"].includes(quote.status) && (
            <Card>
              <CardHeader><CardTitle>Revision</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">현재 Revision을 보존하고 항목을 복사한 새 버전을 만듭니다.</p>
                <CommandForm endpoint="/api/quotation" action="revision.create" constants={{ id: quote.id }} submit="새 Revision 생성" columns={1} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Revision History</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {revisions.map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between"><strong>V{item.revision_no}</strong><Badge variant="outline">{quotationStatusLabels[item.status] ?? item.status}</Badge></div>
                  <p className="mt-2 text-xs text-muted-foreground">총 {money.format(item.total_amount)}원 · {item.quotation_date}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
