import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAnyPage } from "@/shared/auth/account";
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
  const account = await requireAnyPage(["USER_READ", "USER_APPROVE"]);
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
                  {employee.user_status === "REQUESTED" && (
                    <p className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                      소속 조직과 역할을 지정한 뒤 승인하세요. 팀장은 자신이 관리하는 팀에 Member로만 승인할 수 있습니다.
                    </p>
                  )}
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
                      ...(employee.user_status === "REQUESTED" ? [{
                        name: "role_code",
                        label: "승인 역할",
                        type: "select" as const,
                        value: "MEMBER",
                        options: (account.permissions.includes("RBAC_MANAGE")
                          ? ["MEMBER", "TEAM_LEADER", "ADMINISTRATIVE_POSITION", "HEAD"]
                          : account.permissions.includes("USER_READ")
                            ? ["MEMBER", "TEAM_LEADER", "ADMINISTRATIVE_POSITION"]
                            : ["MEMBER"]).map((code) => ({ value: code, label: code.replaceAll("_", " ") })),
                      }] : []),
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
                {employee.user_status === "ACTIVE" ? (
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
                ) : (
                  <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    {employee.user_status === "REQUESTED"
                      ? "먼저 위의 재직 상태 변경에서 계정을 재직으로 승인해 주세요. 승인과 동시에 직원 역할이 자동으로 부여됩니다."
                      : `현재 상태가 ${statusLabels[employee.user_status]}이므로 역할을 변경할 수 없습니다. 재직 상태인 계정만 시스템 역할을 변경할 수 있습니다.`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {rbac && employee.user_status === "ACTIVE" && account.id !== id && (
            <Card>
              <CardHeader><CardTitle>사용자별 권한 예외</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">역할의 기본 권한을 이 계정에만 허용하거나 거부합니다. 거부가 우선 적용됩니다.</p>
                <CommandForm
                  endpoint="/api/admin/user-permissions"
                  action="user.permission"
                  constants={{ user_id: id }}
                  fields={[
                    { name: "permission_code", label: "Permission", type: "select", required: true,
                      options: rbac.permissions.map((permission) => ({ value: permission.code, label: permission.code })) },
                    { name: "operation", label: "적용", type: "select", required: true,
                      options: [{ value: "grant", label: "추가 허용" }, { value: "deny", label: "제한" }, { value: "clear", label: "예외 해제" }] },
                    { name: "data_scope", label: "Data Scope (추가 허용 시)", type: "select",
                      options: ["SELF", "TEAM", "ASSIGNED_PROJECT", "DEPARTMENT", "ALL"].map((value) => ({ value, label: value })) },
                  ]}
                  submit="권한 예외 적용"
                />
                <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {rbac.overrides.filter((override) => override.user_id === id).map((override) => (
                    <li key={override.permission_id}>
                      {rbac.permissions.find((permission) => permission.id === override.permission_id)?.code} · {override.allowed ? `허용 (${override.data_scope})` : "제한"}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {rbac && account.id !== id && (
            <Card>
              <CardHeader>
                <CardTitle>로그인 초기화</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">
                  이메일 확인을 완료하고 안전한 임시 비밀번호를 새로 발급합니다. 임시 비밀번호는
                  처리 직후 한 번만 표시됩니다.
                </p>
                <CommandForm
                  endpoint="/api/admin/users/credentials"
                  action="login.reset"
                  constants={{ id }}
                  flat
                  columns={1}
                  submit="이메일 확인 및 임시 비밀번호 발급"
                  sensitiveResultField="temporaryPassword"
                  sensitiveResultLabel="임시 비밀번호"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
