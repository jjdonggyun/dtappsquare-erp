import { redirect } from "next/navigation";
import { currentAccount } from "@/shared/auth/account";
import { statusLabels } from "@/modules/users/domain/contracts";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
export default async function Status() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  if (account.status === "ACTIVE") redirect("/dashboard");
  return (
    <>
      <PageHeading
        title={statusLabels[account.status]}
        description={`${account.name}님의 현재 계정 상태입니다. 관리자 승인 및 재직 상태에 따라 업무 접근이 허용됩니다.`}
      />
      <CommandForm action="signout" endpoint="/api/auth" flat submit="로그아웃" />
    </>
  );
}
