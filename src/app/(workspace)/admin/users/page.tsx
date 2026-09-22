import Link from "next/link";
import { z } from "zod";
import { Search, RotateCcw, UserPlus } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { employeeList } from "@/modules/users/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { employeeFields } from "@/components/forms/employee-fields";
import { statusLabels, userStatus } from "@/modules/users/domain/contracts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
  TableHead,
} from "@/components/ui/table";
export default async function Users({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; organization?: string }>;
}) {
  const account = await requirePage("USER_READ");
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  const status = userStatus.safeParse(params.status).success ? params.status : undefined;
  const organizationId = z.uuid().safeParse(params.organization).success
    ? params.organization
    : undefined;
  const search = params.q?.trim().slice(0, 80);
  const [list, catalogs] = await Promise.all([
    employeeList({ page, status, organizationId, search }),
    organizationCatalogs(),
  ]);
  const paginationPath = `/admin/users?${new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { q: search } : {}), ...(organizationId ? { organization: organizationId } : {}) })}`;
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE"
        title="직원관리"
        description="직원 정보와 재직 상태를 관리합니다. 직급·직책·시스템 역할은 각각 독립적으로 적용됩니다."
      />
      <Card className="mb-5 py-4">
        <CardContent>
          <form action="/admin/users" className="flex flex-wrap items-end gap-3">
            <label className="min-w-40 flex-1 space-y-2 text-[11px] font-medium text-muted-foreground">
              직원명
              <Input
                name="q"
                placeholder="이름으로 검색"
                defaultValue={search}
                className="bg-white"
              />
            </label>
            <label className="w-44 space-y-2 text-[11px] font-medium text-muted-foreground">
              소속 조직
              <select
                name="organization"
                defaultValue={organizationId ?? ""}
                className="text-xs text-foreground"
              >
                <option value="">전체 조직</option>
                {catalogs.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-32 space-y-2 text-[11px] font-medium text-muted-foreground">
              재직 상태
              <select name="status" defaultValue={status ?? ""} className="text-xs text-foreground">
                <option value="">전체 상태</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="h-10 px-5 text-xs">
              <Search size={14} />
              조회
            </Button>
            <Button asChild variant="outline" size="icon" className="size-10">
              <Link href="/admin/users" aria-label="검색 초기화">
                <RotateCcw size={14} />
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            직원 목록 <span className="ml-2 text-primary">{list.count}</span>
            <span className="ml-1 text-xs font-normal text-muted-foreground">명</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {["직원", "사번", "조직", "직급", "상태", ""].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.email}</p>
                  </TableCell>
                  <TableCell>{row.employee_number ?? "미부여"}</TableCell>
                  <TableCell>
                    {catalogs.organizations.find((o) => o.id === row.organization_id)?.name ??
                      "미배정"}
                  </TableCell>
                  <TableCell>
                    {catalogs.positions.find((o) => o.id === row.position_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        row.user_status === "ACTIVE"
                          ? "bg-[#ecf7f2] text-[#287454]"
                          : "bg-[#fff6dd] text-[#9d7012]"
                      }
                    >
                      {statusLabels[row.user_status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${row.id}`} className="text-primary">
                      상세 보기 →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!list.rows.length && (
            <p className="p-8 text-center text-muted-foreground">등록된 직원이 없습니다.</p>
          )}
          <Pagination page={page} total={list.count} size={25} path={paginationPath} />
        </CardContent>
      </Card>
      {account.permissions.includes("USER_WRITE") &&
        account.permissions.includes("USER_APPROVE") && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus size={17} />
                직원 등록
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-5 text-sm text-muted-foreground">
                즉시 재직 상태로 생성합니다. 활성화 중 실패한 계정은 가입 승인 목록에서 이어서
                처리할 수 있습니다.
              </p>
              <CommandForm
                endpoint="/api/admin/users"
                flat
                submit="직원 생성"
                fields={[
                  { name: "email", label: "이메일", type: "email", required: true },
                  {
                    name: "password",
                    label: "초기 비밀번호 (12자 이상)",
                    type: "password",
                    required: true,
                    minLength: 12,
                  },
                  ...employeeFields(catalogs),
                ]}
              />
            </CardContent>
          </Card>
        )}
    </>
  );
}
