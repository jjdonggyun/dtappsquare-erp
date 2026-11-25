"use client";
import { apiErrorMessage } from "@/shared/browser/api-error";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClientRequestId } from "@/shared/browser/client-request-id";
import { expenseApprovalLabels, expenseSourceLabels, expenseSourceTypes } from "@/modules/expense-finance/domain/contracts";
import type { expenseTypeSchema, unifiedExpenseSchema, vendorSchema } from "@/modules/expense-finance/infrastructure/repository";

type Expense = z.infer<typeof unifiedExpenseSchema>;
type ExpenseType = z.infer<typeof expenseTypeSchema>;
type Vendor = z.infer<typeof vendorSchema>;
type Project = { id: string; project_code: string; project_name: string; closed_at: string | null };
type CardOption = { id: string; card_name: string; last_four: string };
type Assignment = { project_id: string; corporate_card_id: string };
const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export function ExpenseLedger({ expenses, types, vendors, projects, cards, assignments, accountId, canWrite, canManage, today }: {
  expenses: Expense[]; types: ExpenseType[]; vendors: Vendor[]; projects: Project[]; cards: CardOption[]; assignments: Assignment[];
  accountId: string; canWrite: boolean; canManage: boolean; today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [source, setSource] = useState<Expense["source_type"]>("TRANSFER");
  const [projectId, setProjectId] = useState(projects.find((project) => !project.closed_at)?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const openProjects = projects.filter((project) => !project.closed_at);
  const eligibleCardIds = new Set(assignments.filter((assignment) => assignment.project_id === projectId).map((assignment) => assignment.corporate_card_id));
  const cardOptions = cards.filter((card) => eligibleCardIds.has(card.id));
  const totals = expenses.reduce((value, row) => ({
    submitted: value.submitted + (row.approval_status === "SUBMITTED" ? row.total_amount : 0),
    approved: value.approved + (row.approval_status === "APPROVED" ? row.total_amount : 0),
    unpaid: value.unpaid + (row.approval_status === "APPROVED" && !row.paid_at ? row.total_amount : 0),
  }), { submitted: 0, approved: 0, unpaid: 0 });

  async function command(action: string, payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/expense-finance", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Idempotency-Key": createClientRequestId() },
        body: JSON.stringify({ action, payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(body, "처리하지 못했습니다.", response.status));
      setMessage(body.data?.message ?? "처리했습니다."); setEditing(null); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "연결을 확인해 주세요."); }
    finally { setBusy(false); }
  }

  async function upload(expense: Expense, file: File) {
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("expense_id", expense.id); form.set("version", String(expense.version)); form.set("file", file);
      const response = await fetch("/api/corporate-card/receipt", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(body, "증빙을 저장하지 못했습니다.", response.status));
      setMessage("증빙을 저장했습니다."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "연결을 확인해 주세요."); }
    finally { setBusy(false); }
  }

  function beginEdit(row: Expense) {
    setEditing(row); setSource(row.source_type); setProjectId(row.project_id); setMessage("");
  }

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      {[["승인 대기", totals.submitted], ["승인 비용", totals.approved], ["미지급 비용", totals.unpaid]].map(([label, value]) =>
        <Card key={String(label)}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{money.format(Number(value))}원</p></CardContent></Card>)}
    </div>
    <Card><CardHeader><CardTitle>통합 비용 원장</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      <Table><TableHeader><TableRow>{["일자","프로젝트","사용자","거래처 / 목적","유형","결제수단","금액","승인 / 지급","증빙","작업"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{expenses.map((row) => { const own = row.user_id === accountId; const editable = (own || canManage) && ["DRAFT","REJECTED"].includes(row.approval_status); return <TableRow key={row.id}>
          <TableCell>{row.transaction_date}</TableCell><TableCell><p>{row.project?.project_code ?? "—"}</p><p className="text-xs text-muted-foreground">{row.project?.project_name}</p></TableCell>
          <TableCell>{row.user?.name ?? "직원"}</TableCell><TableCell><p className="font-medium">{row.vendor?.name ?? row.merchant}</p><p className="text-xs text-muted-foreground">{row.purpose}</p>{row.rejection_reason ? <p className="text-xs text-destructive">반려: {row.rejection_reason}</p> : null}</TableCell>
          <TableCell>{row.expense_type?.name ?? row.category}</TableCell><TableCell>{expenseSourceLabels[row.source_type as keyof typeof expenseSourceLabels] ?? row.source_type}{row.card ? <p className="text-xs text-muted-foreground">{row.card.card_name} ···· {row.card.last_four}</p> : null}</TableCell>
          <TableCell className="font-semibold">{money.format(row.total_amount)}원</TableCell><TableCell><Badge variant={row.approval_status === "REJECTED" ? "destructive" : "outline"}>{expenseApprovalLabels[row.approval_status] ?? row.approval_status}</Badge><p className="mt-1 text-xs text-muted-foreground">{row.paid_at ? "지급 완료" : "미지급"}</p></TableCell>
          <TableCell>{row.receipt_key ? <a href={`/api/corporate-card/receipt?id=${row.id}`} target="_blank" rel="noreferrer" className="text-primary underline">보기</a> : (own || canManage) ? <label className="cursor-pointer text-primary">등록<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(row, file); }} /></label> : "—"}</TableCell>
          <TableCell><div className="flex min-w-40 flex-wrap gap-1">{editable ? <><Button size="sm" variant="outline" onClick={() => beginEdit(row)}>수정</Button><Button size="sm" disabled={busy} onClick={() => void command("expense.submit", { id: row.id, version: row.version })}>제출</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void command("expense.cancel", { id: row.id, version: row.version })}>취소</Button></> : null}
            {canManage && row.approval_status === "SUBMITTED" ? <><Button size="sm" disabled={busy} onClick={() => void command("expense.approve", { id: row.id, version: row.version, mark_paid: false })}>승인</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { const reason = window.prompt("반려 사유를 입력하세요."); if (reason) void command("expense.reject", { id: row.id, version: row.version, reason }); }}>반려</Button></> : null}
            {canManage && row.approval_status === "APPROVED" && !row.paid_at ? <Button size="sm" disabled={busy} onClick={() => void command("expense.mark_paid", { id: row.id, version: row.version, payment_reference: "" })}>지급 완료</Button> : null}</div></TableCell>
        </TableRow>; })}</TableBody></Table>{!expenses.length ? <p className="py-12 text-center text-sm text-muted-foreground">등록된 비용이 없습니다.</p> : null}
    </CardContent></Card>
    {canWrite ? <Card><CardHeader><CardTitle>{editing ? "비용 수정" : "일반·카드 비용 등록"}</CardTitle></CardHeader><CardContent>
      <form key={editing?.id ?? "new"} className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void command("expense.save", {
        ...(editing ? { id: editing.id, version: editing.version } : {}), transaction_date: form.get("transaction_date"), project_id: form.get("project_id"), source_type: form.get("source_type"), corporate_card_id: form.get("corporate_card_id") || "", expense_type_id: form.get("expense_type_id"), vendor_id: form.get("vendor_id") || "", merchant: form.get("merchant"), purpose: form.get("purpose"), supply_amount: Number(form.get("supply_amount")), vat_amount: Number(form.get("vat_amount")), memo: form.get("memo"),
      }); }}>
        <div className="space-y-2"><Label htmlFor="expense-date">사용일자 *</Label><Input id="expense-date" name="transaction_date" type="date" required defaultValue={editing?.transaction_date ?? today} /></div>
        <div className="space-y-2"><Label htmlFor="expense-project">프로젝트 *</Label><select id="expense-project" name="project_id" required value={projectId} onChange={(event) => setProjectId(event.target.value)}>{openProjects.map((project) => <option key={project.id} value={project.id}>{project.project_code} · {project.project_name}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="expense-source">결제수단 *</Label><select id="expense-source" name="source_type" required value={source} onChange={(event) => setSource(event.target.value)}>{expenseSourceTypes.map((value) => <option key={value} value={value}>{expenseSourceLabels[value]}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="expense-card">법인카드{source === "CARD" ? " *" : ""}</Label><select id="expense-card" name="corporate_card_id" required={source === "CARD"} disabled={source !== "CARD"} defaultValue={editing?.corporate_card_id ?? ""}><option value="">선택하세요</option>{cardOptions.map((card) => <option key={card.id} value={card.id}>{card.card_name} ···· {card.last_four}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="expense-type">비용 유형 *</Label><select id="expense-type" name="expense_type_id" required defaultValue={editing?.expense_type_id ?? ""}><option value="">선택하세요</option>{types.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="expense-vendor">등록 거래처</Label><select id="expense-vendor" name="vendor_id" defaultValue={editing?.vendor_id ?? ""}><option value="">직접 입력</option>{vendors.filter((vendor) => vendor.status === "ACTIVE").map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="expense-merchant">거래처명 *</Label><Input id="expense-merchant" name="merchant" required defaultValue={editing?.merchant ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor="expense-purpose">사용 목적 *</Label><Input id="expense-purpose" name="purpose" required defaultValue={editing?.purpose ?? ""} /></div>
        <div className="space-y-2"><Label htmlFor="expense-supply">공급가액 *</Label><Input id="expense-supply" name="supply_amount" type="number" min="0" step="0.01" required defaultValue={editing?.supply_amount ?? 0} /></div>
        <div className="space-y-2"><Label htmlFor="expense-vat">VAT *</Label><Input id="expense-vat" name="vat_amount" type="number" min="0" step="0.01" required defaultValue={editing?.vat_amount ?? 0} /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="expense-memo">비고</Label><textarea id="expense-memo" name="memo" rows={3} defaultValue={editing?.memo ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy || !projectId}>{busy ? "처리 중…" : "비용 저장"}</Button>{editing ? <Button type="button" variant="ghost" onClick={() => { setEditing(null); setSource("TRANSFER"); }}>새 비용 입력</Button> : null}</div>
      </form>
    </CardContent></Card> : null}
    {message ? <p role="status" className="whitespace-pre-line rounded-md border bg-card p-3 text-sm">{message}</p> : null}
  </div>;
}
