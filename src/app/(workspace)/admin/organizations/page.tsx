import { requirePage } from "@/shared/auth/account";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { CommandForm, type Field } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Organization } from "@/modules/organization/domain/tree";
function fields(
  data: Awaited<ReturnType<typeof organizationCatalogs>>,
  org?: Organization,
): Field[] {
  return [
    { name: "name", label: "조직명", required: true, value: org?.name },
    {
      name: "organization_type",
      label: "조직 유형",
      type: "select",
      required: true,
      value: org?.organization_type ?? "TEAM",
      options: [
        { value: "COMPANY", label: "회사" },
        { value: "DIVISION", label: "본부" },
        { value: "TEAM", label: "팀" },
        { value: "DEPARTMENT", label: "부서" },
      ],
    },
    {
      name: "parent_id",
      label: "상위 조직",
      type: "select",
      value: org?.parent_id ?? "",
      options: data.organizations
        .filter((o) => o.id !== org?.id && o.active)
        .map((o) => ({ value: o.id, label: o.name })),
    },
    {
      name: "leader_user_id",
      label: "조직 리더",
      type: "select",
      value: org?.leader_user_id ?? "",
      options: data.directory.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      name: "sort_order",
      label: "표시 순서",
      type: "number",
      value: org?.sort_order ?? 0,
      required: true,
    },
    { name: "active", label: "활성 조직", type: "checkbox", value: org?.active ?? true },
  ];
}
export default async function OrganizationAdmin() {
  await requirePage("ORGANIZATION_MANAGE");
  const data = await organizationCatalogs();
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZATION SETTINGS"
        title="조직관리"
        description="상위 조직을 변경해 조직을 이동합니다. 순환 구조와 활성 구성원이 있는 조직의 비활성화는 제한됩니다."
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>새 조직</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandForm action="organization.save" fields={fields(data)} submit="조직 생성" />
          </CardContent>
        </Card>
        <div className="space-y-3">
          {data.organizations.map((org) => (
            <Card key={org.id}>
              <CardContent className="py-4">
                <details>
                  <summary className="font-medium">
                    {org.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {org.active ? "활성" : "비활성"}
                    </span>
                  </summary>
                  <div className="mt-5">
                    <CommandForm
                      action="organization.save"
                      constants={{ id: org.id }}
                      fields={fields(data, org)}
                    />
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {(["positions", "titles"] as const).map((catalog) => (
          <Card key={catalog}>
            <CardHeader>
              <CardTitle>{catalog === "positions" ? "직급 · Position" : "직책 · Title"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data[catalog].map((item) => (
                <details key={item.id} className="rounded-lg border p-3">
                  <summary className="text-sm">
                    {item.name} · {item.code}
                  </summary>
                  <div className="mt-4">
                    <CommandForm
                      action="catalog.save"
                      constants={{ id: item.id, catalog }}
                      fields={[
                        { name: "code", label: "코드", value: item.code, required: true },
                        { name: "name", label: "이름", value: item.name, required: true },
                        {
                          name: "sort_order",
                          label: "순서",
                          type: "number",
                          value: item.sort_order,
                        },
                        { name: "active", label: "활성", type: "checkbox", value: item.active },
                      ]}
                    />
                  </div>
                </details>
              ))}
              <details className="border-t pt-4">
                <summary className="text-sm text-primary">새 항목 추가</summary>
                <div className="mt-4">
                  <CommandForm
                    action="catalog.save"
                    constants={{ catalog, active: true, sort_order: 0 }}
                    fields={[
                      { name: "code", label: "코드 (영문 대문자)", required: true },
                      { name: "name", label: "이름", required: true },
                    ]}
                    submit="항목 추가"
                  />
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
