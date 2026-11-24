"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientRequestId } from "@/shared/browser/client-request-id";
import { apiErrorMessage } from "@/shared/browser/api-error";
import type { TaxInvoiceItem } from "@/modules/finance/domain/finance";

type Props = { invoice: { id: string; version: number; issue_date: string; supply_date: string; purpose: string; recipient_name: string; recipient_email: string; note: string; items: TaxInvoiceItem[] } };
const emptyItem = (date: string): TaxInvoiceItem => ({ date, name: "", specification: "", quantity: 1, unitPrice: 0, supplyAmount: 0, vatAmount: 0, note: "" });

export function TaxInvoiceEditor({ invoice }: Props) {
  const [items, setItems] = useState(invoice.items);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const requestKey = useRef<string | null>(null);
  const router = useRouter();
  const totalSupply = items.reduce((sum, item) => sum + Number(item.supplyAmount || 0), 0);
  const totalVat = items.reduce((sum, item) => sum + Number(item.vatAmount || 0), 0);
  const update = (index: number, key: keyof TaxInvoiceItem, value: string | number) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  return <form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = { id: invoice.id, version: invoice.version, issue_date: String(form.get("issue_date")), supply_date: String(form.get("supply_date")), purpose: String(form.get("purpose")), recipient_name: String(form.get("recipient_name") ?? ""), recipient_email: String(form.get("recipient_email")), note: String(form.get("note") ?? ""), items };
    try {
      requestKey.current ??= createClientRequestId();
      const response = await fetch("/api/project-finance", { method: "POST", headers: { "Content-Type": "application/json", "X-Idempotency-Key": requestKey.current }, body: JSON.stringify({ action: "tax_invoice.save", payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(result, "저장하지 못했습니다.", response.status));
      requestKey.current = null; setFailed(false); setMessage(result.data?.message ?? "저장했습니다."); router.refresh();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "연결을 확인해 주세요."); }
    finally { setBusy(false); }
  }}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-2 text-xs text-muted-foreground">작성일자<Input name="issue_date" type="date" defaultValue={invoice.issue_date} required /></label>
      <label className="grid gap-2 text-xs text-muted-foreground">공급일자<Input name="supply_date" type="date" defaultValue={invoice.supply_date} required /></label>
      <label className="grid gap-2 text-xs text-muted-foreground">영수/청구<select name="purpose" defaultValue={invoice.purpose}><option value="CHARGE">청구</option><option value="RECEIPT">영수</option></select></label>
      <label className="grid gap-2 text-xs text-muted-foreground">수신 담당자<Input name="recipient_name" defaultValue={invoice.recipient_name} /></label>
      <label className="grid gap-2 text-xs text-muted-foreground sm:col-span-2">수신 이메일<Input name="recipient_email" type="email" defaultValue={invoice.recipient_email} required /></label>
    </div>
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-[1050px] w-full text-xs"><thead className="bg-muted"><tr>{["일자","품목","규격","수량","단가","공급가액","세액","비고",""] .map((label) => <th className="px-2 py-3 text-left" key={label}>{label}</th>)}</tr></thead><tbody>
        {items.map((item, index) => <tr className="border-t" key={index}>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목 공급일자`} className="w-32" type="date" value={item.date} onChange={(e) => update(index,"date",e.target.value)} required /></td>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목명`} className="w-48" value={item.name} onChange={(e) => update(index,"name",e.target.value)} required /></td>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목 규격`} className="w-28" value={item.specification} onChange={(e) => update(index,"specification",e.target.value)} /></td>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목 수량`} className="w-20" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => update(index,"quantity",Number(e.target.value))} required /></td>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목 단가`} className="w-32" type="number" min="0" step="1" value={item.unitPrice} onChange={(e) => update(index,"unitPrice",Number(e.target.value))} required /></td>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목 공급가액`} className="w-32" type="number" min="0" step="1" value={item.supplyAmount} onChange={(e) => update(index,"supplyAmount",Number(e.target.value))} required /></td>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목 세액`} className="w-28" type="number" min="0" step="1" value={item.vatAmount} onChange={(e) => update(index,"vatAmount",Number(e.target.value))} required /></td>
          <td className="p-2"><Input aria-label={`${index + 1}번 품목 비고`} className="w-32" value={item.note} onChange={(e) => update(index,"note",e.target.value)} /></td>
          <td className="p-2"><Button type="button" variant="ghost" size="sm" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</Button></td>
        </tr>)}
      </tbody><tfoot><tr className="border-t bg-muted/50 font-semibold"><td className="p-3" colSpan={5}>합계</td><td className="p-3">{totalSupply.toLocaleString("ko-KR")}원</td><td className="p-3">{totalVat.toLocaleString("ko-KR")}원</td><td className="p-3" colSpan={2}>{(totalSupply + totalVat).toLocaleString("ko-KR")}원</td></tr></tfoot></table>
    </div>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setItems((current) => [...current, emptyItem(invoice.supply_date)])}>품목 추가</Button><Button disabled={busy}>{busy ? "저장 중…" : "발행자료 저장"}</Button></div>
    <label className="grid gap-2 text-xs text-muted-foreground">비고<textarea name="note" defaultValue={invoice.note} rows={3} className="rounded-md border bg-background px-3 py-2 text-sm" /></label>
    {message && <Alert variant={failed ? "destructive" : "default"}><AlertDescription className="whitespace-pre-line">{message}</AlertDescription></Alert>}
  </form>;
}
