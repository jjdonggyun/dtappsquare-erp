import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAccount } from "@/shared/auth/account";
import { authorize } from "@/modules/rbac/domain/policy";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import { failure, readMutation } from "@/shared/infrastructure/http";

const schema = z.object({
  action: z.literal("user.permission"),
  payload: z.object({
    user_id: z.uuid(),
    permission_code: z.string().regex(/^[A-Z][A-Z0-9_]{1,60}$/),
    operation: z.enum(["grant", "deny", "clear"]),
    data_scope: z.enum(["SELF", "TEAM", "ASSIGNED_PROJECT", "DEPARTMENT", "ALL"]).or(z.literal("")),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const account = await currentAccount();
    authorize(account, "RBAC_MANAGE");
    const input = schema.parse(await readMutation(request));
    const client = await serverClient();
    const result = await client.rpc("user_permission_command", {
      p_user_id: input.payload.user_id,
      p_permission_code: input.payload.permission_code,
      p_action: input.payload.operation,
      p_data_scope: input.payload.data_scope || null,
      p_request_id: requestId,
    });
    if (result.error) throw databaseError(result.error);
    return NextResponse.json({ data: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}
