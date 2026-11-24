import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAccount } from "@/shared/auth/account";
import { authorize } from "@/modules/rbac/domain/policy";
import { createTemporaryPassword } from "@/modules/authentication/domain/temporary-password";
import { provisioningClient } from "@/shared/infrastructure/supabase/admin";
import { AppError } from "@/shared/domain/errors";
import { failure, readMutation } from "@/shared/infrastructure/http";

const resetSchema = z
  .object({
    action: z.literal("login.reset"),
    id: z.uuid(),
  })
  .strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const account = await currentAccount();
    authorize(account, "RBAC_MANAGE");
    const input = resetSchema.parse(await readMutation(request));
    if (input.id === account.id) throw new AppError("ValidationError");

    const temporaryPassword = createTemporaryPassword();
    const { error } = await provisioningClient().auth.admin.updateUserById(input.id, {
      password: temporaryPassword,
      email_confirm: true,
    });
    if (error) {
      if (error.status === 404) throw new AppError("NotFound");
      throw new AppError("InternalError");
    }

    return NextResponse.json(
      {
        data: {
          message: "이메일 확인을 완료하고 임시 비밀번호를 발급했습니다.",
          temporaryPassword,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
