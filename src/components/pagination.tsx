import Link from "next/link";
export function Pagination({
  page,
  total,
  size,
  path,
}: {
  page: number;
  total: number;
  size: number;
  path: string;
}) {
  return (
    <nav
      aria-label="페이지 이동"
      className="mt-5 flex items-center justify-between text-sm text-muted-foreground"
    >
      <span>
        총 {total}건 · {page}페이지
      </span>
      <div className="flex gap-5">
        {page > 1 && (
          <Link
            href={`${path}${path.includes("?") ? "&" : "?"}page=${page - 1}`}
            className="text-primary"
          >
            이전
          </Link>
        )}
        {page * size < total && (
          <Link
            href={`${path}${path.includes("?") ? "&" : "?"}page=${page + 1}`}
            className="text-primary"
          >
            다음
          </Link>
        )}
      </div>
    </nav>
  );
}
