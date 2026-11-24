import type { Field } from "@/components/command-form";

type ContractValues = {
  contract_name: string;
  purchase_order_number: string;
  contract_date: string;
  start_date: string;
  end_date: string;
  supply_amount: number;
  vat_rate: number;
  payment_terms: string;
  warranty_terms: string;
  note: string;
};

export function contractFields(
  defaults: { contractDate: string; startDate: string; endDate: string; supplyAmount: number; vatRate: number },
  contract?: ContractValues,
): Field[] {
  return [
    { name: "contract_name", label: "계약명", value: contract?.contract_name, required: true },
    { name: "purchase_order_number", label: "발주번호", value: contract?.purchase_order_number ?? "" },
    { name: "contract_date", label: "계약일", type: "date", value: contract?.contract_date ?? defaults.contractDate, required: true },
    { name: "start_date", label: "계약 시작일", type: "date", value: contract?.start_date ?? defaults.startDate, required: true },
    { name: "end_date", label: "계약 종료일", type: "date", value: contract?.end_date ?? defaults.endDate, required: true },
    { name: "supply_amount", label: "공급가액", type: "number", value: contract?.supply_amount ?? defaults.supplyAmount, min: 0, step: 1, required: true },
    { name: "vat_rate", label: "VAT (%)", type: "number", value: contract?.vat_rate ?? defaults.vatRate, min: 0, max: 100, step: 0.01, required: true },
    { name: "payment_terms", label: "지급 조건", type: "textarea", value: contract?.payment_terms ?? "" },
    { name: "warranty_terms", label: "하자보증 조건", type: "textarea", value: contract?.warranty_terms ?? "" },
    { name: "note", label: "비고", type: "textarea", value: contract?.note ?? "" },
  ];
}

