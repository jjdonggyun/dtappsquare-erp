import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePage } from "@/shared/auth/account";
import { employeeById } from "@/modules/users/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { roleCatalogs } from "@/modules/rbac/infrastructure/repository";
import { employeeFields } from "@/components/forms/employee-fields";
import { allowedTransitions, statusLabels } from "@/modules/users/domain/contracts";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const account = await requirePage("USER_READ");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [employee, catalogs] = await Promise.all([employeeById(id), organizationCatalogs()]);
  if (!employee) notFound();
  const rbac = account.permissions.includes("RBAC_MANAGE") ? await roleCatalogs() : null;
  return (
    <>
      <PageHeading
        eyebrow="EMPLOYEE PROFILE"
        title={employee.name}
        description={`${employee.email} · ${statusLabels[employee.user_status]}`}
      />
      {account.permissions.includes("WORKFORCE_PROFILE_READ_ALL")&&<p className="mb-5 text-sm"><Link href={`/workforce-profiles/${id}`} className="font-medium text-primary hover:underline">인력프로필 보기 →</Link></p>}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>직원 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {account.permissions.includes("USER_WRITE") ? (
              <CommandForm
                key={employee.version}
                action="employee.update"
                constants={{ id, version: employee.version }}
                fields={employeeFields(catalogs, employee)}
              />
            ) : (
              <dl className="space-y-3">
                {[
                  ["사번", employee.employee_number],
                  ["입사일", employee.join_date],
                  ["전화번호", employee.phone],
                  ["고용형태", employee.employment_type],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd>{value ?? "미등록"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          {account.permissions.includes("USER_APPROVE") &&
            account.id !== id &&
            allowedTransitions(employee.user_status).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>재직 상태 변경</CardTitle>
                </CardHeader>
                <CardContent>
                  <CommandForm
                    key={employee.version}
                    action="employee.status"
                    constants={{ id, version: employee.version }}
                    fields={[
                      {
                        name: "status",
                        label: "변경할 상태",
                        type: "select",
                        required: true,
                        options: allowedTransitions(employee.user_status).map((s) => ({
                          value: s,
                          label: statusLabels[s],
                        })),
                      },
                      {
                        name: "employee_number",
                        label: "사번 (활성화 시 필요)",
                        value: employee.employee_number ?? "",
                      },
                      {
                        name: "join_date",
                        label: "입사일",
                        type: "date",
                        value: employee.join_date ?? "",
                      },
                      {
                        name: "organization_id",
                        label: "소속 조직",
                        type: "select",
                        value: employee.organization_id ?? "",
                        options: catalogs.organizations
                          .filter((o) => o.active)
                          .map((o) => ({ value: o.id, label: o.name })),
                      },
                      {
                        name: "resignation_date",
                        label: "퇴사일 (퇴사 처리 시 필수)",
                        type: "date",
                      },
                    ]}
                    submit="상태 변경"
                  />
                </CardContent>
              </Card>
            )}
          {rbac && (
            <Card>
              <CardHeader>
                <CardTitle>시스템 역할</CardTitle>
              </CardHeader>
              <CardContent>
                <CommandForm
                  action="role.assign"
                  constants={{ id }}
                  fields={[
                    {
                      name: "role_ids",
                      label: "부여할 역할 (복수 선택)",
                      type: "multi",
                      value: rbac.userRoles.filter((r) => r.user_id === id).map((r) => r.role_id),
                      options: rbac.roles
                        .filter((r) => r.active)
                        .map((r) => ({ value: r.id, label: r.name })),
                    },
                  ]}
                  submit="역할 적용"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
