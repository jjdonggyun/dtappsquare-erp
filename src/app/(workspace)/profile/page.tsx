import { notFound } from "next/navigation";
import { requirePage } from "@/shared/auth/account";
import { employeeById } from "@/modules/users/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
export default async function Profile() {
  const account = await requirePage("PROFILE_READ_SELF");
  const [profile, catalogs] = await Promise.all([employeeById(account.id), organizationCatalogs()]);
  if (!profile) notFound();
  return (
    <>
      <PageHeading
        title="내 프로필"
        description="연락처와 프로필 이미지 주소를 관리합니다. 인사정보 변경은 관리자에게 요청해 주세요."
      />
      {account.permissions.includes("WORKFORCE_PROFILE_READ_SELF")&&<p className="mb-5 text-sm"><Link href="/workforce-profiles/me" className="font-medium text-primary hover:underline">인력프로필 보기 →</Link></p>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{profile.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-6">
              {[
                ["이메일", profile.email],
                ["사번", profile.employee_number],
                [
                  "소속",
                  catalogs.organizations.find((o) => o.id === profile.organization_id)?.name,
                ],
                ["직급", catalogs.positions.find((o) => o.id === profile.position_id)?.name],
                ["직책", catalogs.titles.find((o) => o.id === profile.title_id)?.name],
                ["입사일", profile.join_date],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="mb-2 text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-all text-sm">{value ?? "미등록"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>연락처 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandForm
              key={profile.version}
              action="profile.update"
              constants={{ version: profile.version }}
              fields={[
                { name: "phone", label: "전화번호", value: profile.phone ?? "" },
                {
                  name: "profile_image",
                  label: "프로필 이미지 HTTPS URL",
                  value: profile.profile_image ?? "",
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
