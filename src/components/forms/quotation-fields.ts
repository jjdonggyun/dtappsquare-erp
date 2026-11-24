import type { Field } from "@/components/command-form";

type RevisionValues = {
  project_name: string;
  quotation_date: string;
  valid_until: string;
  vat_rate: number;
  expected_cost: number;
  note: string;
};

type ItemValues = {
  item_name: string;
  role_name: string;
  headcount: number;
  man_month: number;
  period_start: string | null;
  period_end: string | null;
  quantity: number;
  unit_price: number;
  note: string;
  sort_order: number;
};

export function quotationCreateFields(
  opportunities: { value: string; label: string }[],
  defaults: { quotationDate: string; validUntil: string },
): Field[] {
  return [
    {
      name: "opportunity_id",
      label: "영업기회",
      type: "select",
      required: true,
      options: opportunities,
    },
    { name: "project_name", label: "프로젝트명", required: true },
    {
      name: "quotation_date",
      label: "견적일",
      type: "date",
      value: defaults.quotationDate,
      required: true,
    },
    {
      name: "valid_until",
      label: "유효기간",
      type: "date",
      value: defaults.validUntil,
      required: true,
    },
    { name: "vat_rate", label: "VAT (%)", type: "number", value: 10, min: 0, max: 100, step: 0.01, required: true },
    { name: "expected_cost", label: "예상원가", type: "number", value: 0, min: 0, step: 1, required: true },
    { name: "note", label: "비고", type: "textarea" },
  ];
}

export function quotationRevisionFields(revision: RevisionValues): Field[] {
  return [
    { name: "project_name", label: "프로젝트명", value: revision.project_name, required: true },
    { name: "quotation_date", label: "견적일", type: "date", value: revision.quotation_date, required: true },
    { name: "valid_until", label: "유효기간", type: "date", value: revision.valid_until, required: true },
    { name: "vat_rate", label: "VAT (%)", type: "number", value: revision.vat_rate, min: 0, max: 100, step: 0.01, required: true },
    { name: "expected_cost", label: "예상원가", type: "number", value: revision.expected_cost, min: 0, step: 1, required: true },
    { name: "note", label: "비고", type: "textarea", value: revision.note },
  ];
}

export function quotationItemFields(item?: ItemValues): Field[] {
  return [
    { name: "item_name", label: "항목", value: item?.item_name, required: true },
    { name: "role_name", label: "인력 Role", value: item?.role_name ?? "" },
    { name: "headcount", label: "인원", type: "number", value: item?.headcount ?? 1, min: 0, step: 1, required: true },
    { name: "man_month", label: "MM", type: "number", value: item?.man_month ?? 0, min: 0, step: 0.01, required: true },
    { name: "period_start", label: "기간 시작", type: "date", value: item?.period_start ?? "" },
    { name: "period_end", label: "기간 종료", type: "date", value: item?.period_end ?? "" },
    { name: "quantity", label: "수량", type: "number", value: item?.quantity ?? 1, min: 0.01, step: 0.01, required: true },
    { name: "unit_price", label: "단가", type: "number", value: item?.unit_price ?? 0, min: 0, step: 1, required: true },
    { name: "sort_order", label: "표시 순서", type: "number", value: item?.sort_order ?? 0, min: 0, step: 1, required: true },
    { name: "note", label: "비고", type: "textarea", value: item?.note ?? "" },
  ];
}

