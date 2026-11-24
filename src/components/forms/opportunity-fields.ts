import type { Field } from "@/components/command-form";

type OpportunityValues = {
  customer_id: string;
  sales_owner_id: string;
  title: string;
  expected_project_name: string;
  expected_amount: number;
  probability: number;
  expected_start_date: string | null;
  expected_end_date: string | null;
  proposal_due_date: string | null;
  competitor: string;
  note: string;
};

type Option = { value: string; label: string };

export function opportunityFields(
  customers: Option[],
  owners: Option[],
  opportunity?: OpportunityValues,
): Field[] {
  return [
    {
      name: "customer_id",
      label: "고객사",
      type: "select",
      value: opportunity?.customer_id,
      required: true,
      options: customers,
    },
    {
      name: "sales_owner_id",
      label: "담당 영업",
      type: "select",
      value: opportunity?.sales_owner_id ?? owners[0]?.value,
      required: true,
      options: owners,
    },
    { name: "title", label: "Opportunity Name", value: opportunity?.title, required: true },
    {
      name: "expected_project_name",
      label: "예상 프로젝트명",
      value: opportunity?.expected_project_name ?? "",
    },
    {
      name: "expected_amount",
      label: "예상 계약금액",
      type: "number",
      value: opportunity?.expected_amount ?? 0,
      min: 0,
      step: 1,
      required: true,
    },
    {
      name: "probability",
      label: "수주 가능성 (%)",
      type: "number",
      value: opportunity?.probability ?? 10,
      min: 0,
      max: 100,
      step: 1,
      required: true,
    },
    {
      name: "expected_start_date",
      label: "예상 시작일",
      type: "date",
      value: opportunity?.expected_start_date ?? "",
    },
    {
      name: "expected_end_date",
      label: "예상 종료일",
      type: "date",
      value: opportunity?.expected_end_date ?? "",
    },
    {
      name: "proposal_due_date",
      label: "제안 예정일",
      type: "date",
      value: opportunity?.proposal_due_date ?? "",
    },
    { name: "competitor", label: "경쟁사", value: opportunity?.competitor ?? "" },
    { name: "note", label: "비고", type: "textarea", value: opportunity?.note ?? "" },
  ];
}

