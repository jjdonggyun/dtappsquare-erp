import type { Field } from "@/components/command-form";
import type { Employee } from "@/modules/users/domain/contracts";
type Option = { id: string; name: string };
export function employeeFields(
  catalogs: { organizations: Option[]; positions: Option[]; titles: Option[] },
  employee?: Employee,
): Field[] {
  const options = (items: Option[]) => items.map((item) => ({ value: item.id, label: item.name }));
  return [
    { name: "name", label: "이름", value: employee?.name, required: true },
    {
      name: "employee_number",
      label: "사번",
      value: employee?.employee_number ?? "",
      required: true,
    },
    { name: "phone", label: "연락처", value: employee?.phone ?? "" },
    {
      name: "join_date",
      label: "입사일",
      type: "date",
      value: employee?.join_date ?? "",
      required: true,
    },
    {
      name: "organization_id",
      label: "소속 조직",
      type: "select",
      options: options(catalogs.organizations),
      value: employee?.organization_id ?? "",
      required: true,
    },
    {
      name: "position_id",
      label: "직급 (Position)",
      type: "select",
      options: options(catalogs.positions),
      value: employee?.position_id ?? "",
    },
    {
      name: "title_id",
      label: "직책 (Title)",
      type: "select",
      options: options(catalogs.titles),
      value: employee?.title_id ?? "",
    },
    {
      name: "employment_type",
      label: "고용형태",
      type: "select",
      options: [
        { value: "FULL_TIME", label: "정규직" },
        { value: "CONTRACT", label: "계약직" },
        { value: "PART_TIME", label: "시간제" },
        { value: "INTERN", label: "인턴" },
      ],
      value: employee?.employment_type ?? "FULL_TIME",
      required: true,
    },
  ];
}
