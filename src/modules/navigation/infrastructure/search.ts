import "server-only";

import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

export type GlobalSearchResult = {
  id: string;
  kind: "CUSTOMER" | "OPPORTUNITY" | "QUOTATION" | "CONTRACT" | "PROJECT" | "BILLING" | "TAX_INVOICE" | "PAYMENT";
  kindLabel: string;
  code: string;
  title: string;
  href: string;
  status: string;
  updatedAt: string;
};

function hasAny(permissions: readonly string[], required: readonly string[]) {
  return required.some((permission) => permissions.includes(permission));
}

function searchTerm(value: string) {
  return value.replace(/[%_,().]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function globalSearch(value: string, permissions: readonly string[]) {
  const term = searchTerm(value);
  if (term.length < 2) return [] satisfies GlobalSearchResult[];
  const client = await serverClient();
  const tasks: Promise<GlobalSearchResult[]>[] = [];

  if (hasAny(permissions, ["CUSTOMER_READ", "CUSTOMER_MANAGE"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("customers")
        .select("id,customer_code,name,status,updated_at")
        .or(`name.ilike.%${term}%,customer_code.ilike.%${term}%`)
        .order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "CUSTOMER" as const, kindLabel: "고객사", code: row.customer_code, title: row.name, href: `/customers/${row.id}`, status: row.status, updatedAt: row.updated_at }));
    })());
  }
  if (hasAny(permissions, ["OPPORTUNITY_READ", "OPPORTUNITY_READ_ALL", "OPPORTUNITY_MANAGE"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("opportunities")
        .select("id,opportunity_code,title,stage,updated_at")
        .or(`title.ilike.%${term}%,opportunity_code.ilike.%${term}%,expected_project_name.ilike.%${term}%`)
        .order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "OPPORTUNITY" as const, kindLabel: "영업기회", code: row.opportunity_code, title: row.title, href: `/opportunities/${row.id}`, status: row.stage, updatedAt: row.updated_at }));
    })());
  }
  if (hasAny(permissions, ["QUOTATION_READ", "QUOTATION_READ_ALL", "QUOTATION_MANAGE", "QUOTATION_APPROVE"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("quotations")
        .select("id,quotation_number,status,updated_at")
        .ilike("quotation_number", `%${term}%`).order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "QUOTATION" as const, kindLabel: "견적", code: row.quotation_number, title: "견적서", href: `/quotations/${row.id}`, status: row.status, updatedAt: row.updated_at }));
    })());
  }
  if (hasAny(permissions, ["CONTRACT_READ", "CONTRACT_READ_ALL", "CONTRACT_MANAGE", "CONTRACT_APPROVE"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("contracts")
        .select("id,contract_number,contract_name,status,updated_at")
        .or(`contract_name.ilike.%${term}%,contract_number.ilike.%${term}%,purchase_order_number.ilike.%${term}%`)
        .order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "CONTRACT" as const, kindLabel: "계약", code: row.contract_number, title: row.contract_name, href: `/contracts/${row.id}`, status: row.status, updatedAt: row.updated_at }));
    })());
  }
  if (hasAny(permissions, ["PROJECT_READ_SELF", "PROJECT_READ", "PROJECT_READ_ALL"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("projects")
        .select("id,project_code,project_name,status,updated_at")
        .or(`project_name.ilike.%${term}%,project_code.ilike.%${term}%,customer_name.ilike.%${term}%`)
        .order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "PROJECT" as const, kindLabel: "프로젝트", code: row.project_code, title: row.project_name, href: `/projects/${row.id}`, status: row.status, updatedAt: row.updated_at }));
    })());
  }
  if (hasAny(permissions, ["BILLING_READ", "BILLING_READ_ALL", "BILLING_MANAGE"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("billings")
        .select("id,billing_number,title,status,updated_at")
        .or(`title.ilike.%${term}%,billing_number.ilike.%${term}%`)
        .order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "BILLING" as const, kindLabel: "청구", code: row.billing_number, title: row.title, href: `/finance/billings/${row.id}`, status: row.status, updatedAt: row.updated_at }));
    })());
  }
  if (hasAny(permissions, ["TAX_INVOICE_READ", "TAX_INVOICE_READ_ALL", "TAX_INVOICE_MANAGE"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("tax_invoices")
        .select("id,invoice_number,buyer_name,status,updated_at")
        .or(`invoice_number.ilike.%${term}%,buyer_name.ilike.%${term}%,nts_approval_number.ilike.%${term}%`)
        .order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "TAX_INVOICE" as const, kindLabel: "세금계산서", code: row.invoice_number, title: row.buyer_name, href: `/finance/tax-invoices/${row.id}`, status: row.status, updatedAt: row.updated_at }));
    })());
  }
  if (hasAny(permissions, ["PAYMENT_READ", "PAYMENT_READ_ALL", "PAYMENT_MANAGE"])) {
    tasks.push((async () => {
      const { data, error } = await client.from("payments")
        .select("id,payment_number,payer_name,status,updated_at")
        .or(`payment_number.ilike.%${term}%,payer_name.ilike.%${term}%,bank_reference.ilike.%${term}%`)
        .order("updated_at", { ascending: false }).limit(12);
      if (error) throw databaseError(error);
      return (data ?? []).map((row) => ({ id: row.id, kind: "PAYMENT" as const, kindLabel: "입금", code: row.payment_number, title: row.payer_name, href: "/finance/payments", status: row.status, updatedAt: row.updated_at }));
    })());
  }

  const result = (await Promise.all(tasks)).flat();
  return result.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 50);
}
