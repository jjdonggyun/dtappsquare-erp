import type { Field } from "@/components/command-form";
import { contactTypeLabels, contactTypes } from "@/modules/customer/domain/contracts";

type CustomerValues = {
  customer_code: string;
  name: string;
  business_registration_number: string | null;
  representative_name: string | null;
  address: string;
  business_type: string;
  business_item: string;
  billing_contact_name: string;
  billing_email: string | null;
  payment_terms: string;
  default_payment_terms: string;
  note: string;
  status: string;
};

type ContactValues = {
  name: string;
  department: string;
  position: string;
  phone: string;
  email: string | null;
  contact_type: string;
  is_primary: boolean;
  active: boolean;
};

export function customerFields(customer?: CustomerValues): Field[] {
  return [
    { name: "customer_code", label: "고객사 코드", value: customer?.customer_code, required: true },
    { name: "name", label: "고객사명", value: customer?.name, required: true },
    {
      name: "business_registration_number",
      label: "사업자등록번호",
      value: customer?.business_registration_number ?? "",
    },
    { name: "representative_name", label: "대표자명", value: customer?.representative_name ?? "" },
    { name: "business_type", label: "업태", value: customer?.business_type ?? "" },
    { name: "business_item", label: "종목", value: customer?.business_item ?? "" },
    { name: "address", label: "주소", type: "textarea", value: customer?.address ?? "" },
    { name: "billing_contact_name", label: "세금계산서 담당자", value: customer?.billing_contact_name ?? "" },
    { name: "billing_email", label: "세금계산서 이메일", type: "email", value: customer?.billing_email ?? "" },
    { name: "payment_terms", label: "결제 조건", type: "textarea", value: customer?.payment_terms ?? "" },
    { name: "default_payment_terms", label: "기본 지급 조건", type: "textarea", value: customer?.default_payment_terms ?? "" },
    { name: "note", label: "비고", type: "textarea", value: customer?.note ?? "" },
    {
      name: "status",
      label: "상태",
      type: "select",
      value: customer?.status ?? "ACTIVE",
      required: true,
      options: [
        { value: "ACTIVE", label: "거래 중" },
        { value: "INACTIVE", label: "거래 중지" },
      ],
    },
  ];
}

export function contactFields(contact?: ContactValues): Field[] {
  return [
    { name: "name", label: "담당자명", value: contact?.name, required: true },
    { name: "department", label: "부서", value: contact?.department ?? "" },
    { name: "position", label: "직책", value: contact?.position ?? "" },
    { name: "phone", label: "연락처", value: contact?.phone ?? "" },
    { name: "email", label: "이메일", type: "email", value: contact?.email ?? "" },
    {
      name: "contact_type",
      label: "담당 유형",
      type: "select",
      value: contact?.contact_type ?? "GENERAL",
      required: true,
      options: contactTypes.map((value) => ({ value, label: contactTypeLabels[value] })),
    },
    { name: "is_primary", label: "이 유형의 대표 담당자", type: "checkbox", value: contact?.is_primary ?? false },
    { name: "active", label: "사용", type: "checkbox", value: contact?.active ?? true },
  ];
}
