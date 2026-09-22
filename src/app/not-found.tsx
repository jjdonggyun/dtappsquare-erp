import Link from "next/link";
export default function NotFound() {
  return (
    <main className="p-12">
      <h1 className="mb-4 text-2xl">페이지를 찾을 수 없습니다.</h1>
      <Link href="/dashboard" className="text-primary underline">
        Dashboard로 이동
      </Link>
    </main>
  );
}
