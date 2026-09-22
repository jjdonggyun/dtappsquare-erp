import { requirePage } from "@/shared/auth/account";
import { roleCatalogs } from "@/modules/rbac/infrastructure/repository";
import { CommandForm, type Field } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default async function Roles() {
  await requirePage("RBAC_MANAGE");
  const data = await roleCatalogs();
  const fields = (role?: (typeof data.roles)[number]): Field[] => [
    { name: "code", label: "역할 코드", required: true, value: role?.code },
    { name: "name", label: "역할 이름", required: true, value: role?.name },
    { name: "active", label: "활성", type: "checkbox", value: role?.active ?? true },
    {
      name: "permission_ids",
      label: "허용 권한",
      type: "multi",
      value: data.mappings.filter((m) => m.role_id === role?.id).map((m) => m.permission_id),
      options: data.permissions.map((p) => ({ value: p.id, label: p.code })),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="ACCESS CONTROL"
        title="시스템관리"
        description="역할과 권한을 관리합니다. 직원별 복수 역할은 직원 상세 화면에서 지정합니다."
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>새 역할</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandForm action="role.save" fields={fields()} submit="역할 생성" />
          </CardContent>
        </Card>
        <div className="space-y-4">
          {data.roles.map((role) => (
            <Card key={role.id}>
              <CardContent className="py-5">
                <details>
                  <summary className="font-medium">
                    {role.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {role.code} · {data.mappings.filter((m) => m.role_id === role.id).length}개
                      권한
                    </span>
                  </summary>
                  <div className="mt-5">
                    {role.code === "ADMIN" ? (
                      <p className="text-sm text-muted-foreground">
                        기본 ADMIN의 전체 권한은 migration으로 관리하며 UI에서 변경할 수 없습니다.
                      </p>
                    ) : (
                      <CommandForm
                        action="role.save"
                        constants={{ id: role.id }}
                        fields={fields(role)}
                      />
                    )}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
