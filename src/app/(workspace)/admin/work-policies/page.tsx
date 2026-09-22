import { requirePage } from "@/shared/auth/account";
import { workPolicyCatalog } from "@/modules/work-policy/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const days = [
  { value: "1", label: "월" },
  { value: "2", label: "화" },
  { value: "3", label: "수" },
  { value: "4", label: "목" },
  { value: "5", label: "금" },
  { value: "6", label: "토" },
  { value: "7", label: "일" },
];

export default async function WorkPolicyPage() {
  await requirePage("WORK_POLICY_MANAGE");
  const [data, catalogs] = await Promise.all([workPolicyCatalog(), organizationCatalogs()]);
  const today = dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE);
  const people = new Map(catalogs.directory.map((person) => [person.id, person.name]));
  const policies = new Map(data.policies.map((policy) => [policy.id, policy]));
  return (
    <>
      <PageHeading
        eyebrow="WORK POLICY"
        title="근무정책 관리"
        description="근무시간 변경은 새 버전으로 생성하고 적용 시작일을 지정합니다. 이미 배정된 버전의 판정 기준은 수정할 수 없습니다."
      />
      <div className="mb-6 grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>새 정책 버전</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandForm
              endpoint="/api/workforce"
              action="work_policy.create"
              fields={[
                { name: "code", label: "정책 코드", value: "STANDARD", required: true },
                { name: "name", label: "정책명", required: true },
                {
                  name: "check_in_time",
                  label: "출근 기준",
                  type: "time",
                  value: "09:00",
                  required: true,
                },
                {
                  name: "check_out_time",
                  label: "퇴근 기준",
                  type: "time",
                  value: "18:00",
                  required: true,
                },
                { name: "break_start", label: "휴게 시작", type: "time", value: "12:00" },
                { name: "break_end", label: "휴게 종료", type: "time", value: "13:00" },
                {
                  name: "late_grace_minutes",
                  label: "지각 유예(분)",
                  type: "number",
                  value: 5,
                  required: true,
                },
                { name: "timezone", label: "시간대", value: "Asia/Seoul", required: true },
                {
                  name: "working_days",
                  label: "근무 요일",
                  type: "multi",
                  value: ["1", "2", "3", "4", "5"],
                  options: days,
                },
              ]}
              submit="정책 버전 생성"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>직원 정책 배정</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandForm
              endpoint="/api/workforce"
              action="work_policy.assign"
              fields={[
                {
                  name: "user_id",
                  label: "직원",
                  type: "select",
                  required: true,
                  options: catalogs.directory.map((person) => ({
                    value: person.id,
                    label: person.name,
                  })),
                },
                {
                  name: "work_policy_id",
                  label: "정책 버전",
                  type: "select",
                  required: true,
                  options: data.policies
                    .filter((policy) => policy.active)
                    .map((policy) => ({
                      value: policy.id,
                      label: `${policy.name} · ${policy.code} v${policy.version}`,
                    })),
                },
                {
                  name: "effective_from",
                  label: "적용 시작일",
                  type: "date",
                  value: today,
                  required: true,
                },
                { name: "effective_to", label: "적용 종료일(미포함)", type: "date" },
              ]}
              submit="근무정책 배정"
            />
          </CardContent>
        </Card>
      </div>
      <Card className="mb-6 gap-0 py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle>정책 버전</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">코드 / 버전</TableHead>
                <TableHead>정책명</TableHead>
                <TableHead>근무시간</TableHead>
                <TableHead>휴게시간</TableHead>
                <TableHead>유예</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="pl-5 font-medium">
                    {policy.code} <span className="text-muted-foreground">v{policy.version}</span>
                  </TableCell>
                  <TableCell>{policy.name}</TableCell>
                  <TableCell>
                    {policy.check_in_time.slice(0, 5)}–{policy.check_out_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    {policy.break_start?.slice(0, 5) ?? "—"}–{policy.break_end?.slice(0, 5) ?? "—"}
                  </TableCell>
                  <TableCell>{policy.late_grace_minutes}분</TableCell>
                  <TableCell>
                    <Badge variant="outline">{policy.active ? "활성" : "보관"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle>배정 이력</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">직원</TableHead>
                <TableHead>정책</TableHead>
                <TableHead>적용 시작</TableHead>
                <TableHead>적용 종료</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.assignments.map((assignment) => {
                const policy = policies.get(assignment.work_policy_id);
                return (
                  <TableRow key={assignment.id}>
                    <TableCell className="pl-5 font-medium">
                      {people.get(assignment.user_id) ?? "조회 제한"}
                    </TableCell>
                    <TableCell>{policy ? `${policy.name} v${policy.version}` : "—"}</TableCell>
                    <TableCell>{assignment.effective_from}</TableCell>
                    <TableCell>{assignment.effective_to ?? "현재"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
