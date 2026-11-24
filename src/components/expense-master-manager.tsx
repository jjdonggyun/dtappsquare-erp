"use client";

import { useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommandForm } from "@/components/command-form";
import type { expenseTypeSchema, vendorSchema } from "@/modules/expense-finance/infrastructure/repository";

type ExpenseType = z.infer<typeof expenseTypeSchema>;
type Vendor = z.infer<typeof vendorSchema>;

export function ExpenseMasterManager({ types, vendors }: { types: ExpenseType[]; vendors: Vendor[] }) {
  const [editingType, setEditingType] = useState<ExpenseType | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  return <div className="grid gap-6 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>비용 유형</CardTitle></CardHeader><CardContent className="space-y-5">
      <Table><TableHeader><TableRow><TableHead>코드 / 유형</TableHead><TableHead>계정코드</TableHead><TableHead>부가세</TableHead><TableHead>상태</TableHead><TableHead /></TableRow></TableHeader><TableBody>{types.map((type) => <TableRow key={type.id}><TableCell><p className="font-medium">{type.name}</p><p className="text-xs text-muted-foreground">{type.code}</p></TableCell><TableCell>{type.account_code || "—"}</TableCell><TableCell>{type.vat_deductible ? "공제" : "불공제"}</TableCell><TableCell><Badge variant="outline">{type.active ? "사용" : "중지"}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setEditingType(type)}>수정</Button></TableCell></TableRow>)}</TableBody></Table>
      <div className="rounded-md border p-4"><p className="mb-4 text-sm font-semibold">{editingType ? "비용 유형 수정" : "비용 유형 추가"}</p><CommandForm key={editingType?.id ?? "new-type"} endpoint="/api/expense-finance" action="expense_type.save" constants={editingType ? { id: editingType.id, version: editingType.version } : {}} fields={[
        { name: "code", label: "코드", value: editingType?.code ?? "", required: true }, { name: "name", label: "유형명", value: editingType?.name ?? "", required: true },
        { name: "account_code", label: "계정코드", value: editingType?.account_code ?? "" }, { name: "sort_order", label: "정렬순서", type: "number", min: 0, value: editingType?.sort_order ?? 100 },
        { name: "vat_deductible", label: "매입세액 공제", type: "checkbox", value: editingType?.vat_deductible ?? true }, { name: "active", label: "사용", type: "checkbox", value: editingType?.active ?? true },
        { name: "note", label: "비고", type: "textarea", value: editingType?.note ?? "" },
      ]} submit="비용 유형 저장" />{editingType ? <Button className="mt-2" size="sm" variant="ghost" onClick={() => setEditingType(null)}>새 유형 입력</Button> : null}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>거래처 · 외주처</CardTitle></CardHeader><CardContent className="space-y-5">
      <Table><TableHeader><TableRow><TableHead>거래처</TableHead><TableHead>사업자번호</TableHead><TableHead>담당자</TableHead><TableHead>상태</TableHead><TableHead /></TableRow></TableHeader><TableBody>{vendors.map((vendor) => <TableRow key={vendor.id}><TableCell><p className="font-medium">{vendor.name}</p><p className="text-xs text-muted-foreground">{vendor.vendor_code}</p></TableCell><TableCell>{vendor.business_registration_number ?? "—"}</TableCell><TableCell>{vendor.contact_name || "—"}<p className="text-xs text-muted-foreground">{vendor.contact_email ?? ""}</p></TableCell><TableCell><Badge variant="outline">{vendor.status}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setEditingVendor(vendor)}>수정</Button></TableCell></TableRow>)}</TableBody></Table>{!vendors.length ? <p className="text-sm text-muted-foreground">등록된 거래처가 없습니다.</p> : null}
      <div className="rounded-md border p-4"><p className="mb-4 text-sm font-semibold">{editingVendor ? "거래처 수정" : "거래처 추가"}</p><CommandForm key={editingVendor?.id ?? "new-vendor"} endpoint="/api/expense-finance" action="vendor.save" constants={editingVendor ? { id: editingVendor.id, version: editingVendor.version } : {}} fields={[
        { name: "name", label: "거래처명", value: editingVendor?.name ?? "", required: true }, { name: "business_registration_number", label: "사업자등록번호", value: editingVendor?.business_registration_number ?? "" },
        { name: "representative_name", label: "대표자", value: editingVendor?.representative_name ?? "" }, { name: "address", label: "주소", value: editingVendor?.address ?? "" },
        { name: "business_type", label: "업태", value: editingVendor?.business_type ?? "" }, { name: "business_item", label: "종목", value: editingVendor?.business_item ?? "" },
        { name: "contact_name", label: "담당자", value: editingVendor?.contact_name ?? "" }, { name: "contact_email", label: "이메일", type: "email", value: editingVendor?.contact_email ?? "" },
        { name: "contact_phone", label: "연락처", value: editingVendor?.contact_phone ?? "" }, { name: "status", label: "상태", type: "select", value: editingVendor?.status ?? "ACTIVE", options: [{ value: "ACTIVE", label: "사용" }, { value: "INACTIVE", label: "중지" }, { value: "ARCHIVED", label: "보관" }] },
        { name: "note", label: "비고", type: "textarea", value: editingVendor?.note ?? "" },
      ]} submit="거래처 저장" />{editingVendor ? <Button className="mt-2" size="sm" variant="ghost" onClick={() => setEditingVendor(null)}>새 거래처 입력</Button> : null}</div>
    </CardContent></Card>
  </div>;
}
