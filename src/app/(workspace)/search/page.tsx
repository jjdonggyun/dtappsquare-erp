import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { globalSearch } from "@/modules/navigation/infrastructure/search";
import { PageHeading } from "@/components/page-heading";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const account = await requirePage("PROFILE_READ_SELF");
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 80);
  const results = query.length >= 2 ? await globalSearch(query, account.permissions) : [];

  return (
    <>
      <PageHeading eyebrow="GLOBAL SEARCH" title="통합 검색" description="현재 권한으로 볼 수 있는 고객·영업·프로젝트·재무 데이터를 한 번에 찾습니다." />
      <form action="/search" method="get" role="search" className="mb-6 flex max-w-2xl gap-2">
        <label className="relative flex-1">
          <span className="sr-only">검색어</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input name="q" type="search" required minLength={2} maxLength={80} defaultValue={query} placeholder="고객명, 프로젝트명, 문서번호를 입력하세요" className="h-10 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
        </label>
        <Button type="submit">검색</Button>
      </form>
      {query.length < 2 ? (
        <EmptyState title="두 글자 이상 입력해 주세요." description="업무 코드, 고객명, 프로젝트명 또는 문서번호로 검색할 수 있습니다." />
      ) : (
        <DataTable
          title={`“${query}” 검색 결과 ${results.length}건`}
          description="검색 결과는 계정의 권한과 데이터 범위 정책(RLS)에 따라 제한됩니다."
          columns={[
            { id: "kind", label: "구분" },
            { id: "code", label: "업무 코드" },
            { id: "title", label: "제목" },
            { id: "status", label: "상태" },
            { id: "updated", label: "최근 변경" },
            { id: "action", label: "이동", align: "right" },
          ]}
          rows={results.map((result) => ({
            id: `${result.kind}-${result.id}`,
            cells: {
              kind: <span className="text-xs text-muted-foreground">{result.kindLabel}</span>,
              code: <span className="font-mono text-xs">{result.code}</span>,
              title: <Link href={result.href} className="font-medium hover:text-primary hover:underline">{result.title}</Link>,
              status: <StatusBadge status={result.status} />,
              updated: <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(result.updatedAt))}</span>,
              action: <Link href={result.href} aria-label={`${result.title} 열기`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">열기 <ArrowUpRight size={13} /></Link>,
            },
          }))}
          emptyTitle="검색 결과가 없습니다."
          emptyDescription="다른 검색어를 사용하거나 접근 권한을 확인해 주세요."
        />
      )}
    </>
  );
}
