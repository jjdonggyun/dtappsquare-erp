import Link from "next/link";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { configured } from "@/shared/infrastructure/env";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <PageHeading title="워크스페이스 로그인" description="회사 계정으로 로그인해 주세요." />
      {params.confirmation === "failed" && (
        <p role="alert" className="mb-4 text-destructive">
          이메일 확인 링크가 만료되었거나 유효하지 않습니다.
        </p>
      )}
      {configured() ? (
        <CommandForm
          action="login"
          endpoint="/api/auth"
          flat
          columns={1}
          submit="로그인"
          fields={[
            { name: "email", label: "이메일", type: "email", required: true },
            { name: "password", label: "비밀번호", type: "password", required: true },
          ]}
        />
      ) : (
        <p role="alert">서버 환경 설정이 필요합니다. README의 로컬 실행 절차를 확인해 주세요.</p>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="text-primary">
          가입 요청
        </Link>
      </p>
    </>
  );
}
