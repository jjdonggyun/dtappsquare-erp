import Link from "next/link";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <PageHeading
        title="새 계정 요청"
        description="가입 요청 후 관리자 승인을 받으면 업무 시스템을 이용할 수 있습니다."
      />
      {params.submitted === "1" && (
        <p role="status" className="mb-4 text-sm text-primary">
          가입 요청을 접수했습니다. 이메일 확인 후 관리자 승인을 기다려 주세요.
        </p>
      )}
      {params.error === "invalid" && (
        <p role="alert" className="mb-4 text-destructive">
          입력값을 확인해 주세요.
        </p>
      )}
      <CommandForm
        action="signup"
        endpoint="/api/auth"
        flat
        columns={1}
        submit="가입 요청"
        fields={[
          { name: "name", label: "이름", required: true },
          { name: "email", label: "회사 이메일", type: "email", required: true },
          {
            name: "password",
            label: "비밀번호 (12자 이상)",
            type: "password",
            minLength: 12,
            required: true,
          },
        ]}
      />
      <Link href="/login" className="mt-6 block text-sm text-primary">
        로그인으로 돌아가기
      </Link>
    </>
  );
}
