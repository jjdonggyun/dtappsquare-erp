import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { authorize } from "@/modules/rbac/domain/policy";
import { createEmployeeSchema } from "@/modules/users/application/commands";
import { employeeById, employeeList } from "@/modules/users/infrastructure/repository";
import { managementRepository } from "@/shared/infrastructure/management-repository";
import { provisioningClient } from "@/shared/infrastructure/supabase/admin";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { AppError } from "@/shared/domain/errors";
export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    authorize(await currentAccount(), "USER_READ");
    return NextResponse.json(
      { data: await employeeList() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const account = await currentAccount();
    authorize(account, "USER_WRITE");
    authorize(account, "USER_APPROVE");
    const input = createEmployeeSchema.parse(await readMutation(request));
    const { data, error } = await provisioningClient().auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (error) throw new AppError(error.status === 422 ? "Conflict" : "InternalError");
    const profile = await employeeById(data.user.id);
    if (!profile) throw new AppError("InternalError");
    const repository = managementRepository();
    await repository.execute(
      {
        action: "employee.update",
        payload: {
          id: profile.id,
          version: profile.version,
          name: input.name,
          employee_number: input.employee_number,
          phone: input.phone,
          join_date: input.join_date,
          organization_id: input.organization_id,
          position_id: input.position_id,
          title_id: input.title_id,
          employment_type: input.employment_type,
        },
      },
      requestId,
    );
    await repository.execute(
      {
        action: "employee.status",
        payload: { id: profile.id, version: profile.version + 1, status: "ACTIVE" },
      },
      requestId,
    );
    return NextResponse.json({ data: { id: profile.id } }, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}
