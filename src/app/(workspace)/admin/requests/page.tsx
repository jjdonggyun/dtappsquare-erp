import Link from "next/link";
import { requirePage } from "@/shared/auth/account";
import { employeeList } from "@/modules/users/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";
export default async function Requests({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePage("USER_APPROVE");
  const page = Math.max(1, Math.min(10000, Number((await searchParams).page) || 1));
  const list = await employeeList({ status: "REQUESTED", page });
  return (
    <>
      <PageHeading
        eyebrow="ONBOARDING"
        title="가입 승인"
        description="가입 요청을 확인하고 사번·소속·입사일을 지정한 후 승인하거나 반려합니다."
      />
      <div className="space-y-3">
        {list.rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex items-center justify-between gap-4 py-5">
              <div>
                <h2 className="font-medium">{row.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{row.email}</p>
              </div>
              <Link href={`/admin/users/${row.id}`} className="text-sm text-primary">
                요청 검토 →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      {!list.rows.length && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            검토할 가입 요청이 없습니다.
          </CardContent>
        </Card>
      )}
      <Pagination page={page} total={list.count} size={25} path="/admin/requests" />
    </>
  );
}
