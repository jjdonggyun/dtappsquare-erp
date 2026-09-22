import { NextResponse } from "next/server";
import { authenticate } from "@/modules/authentication/application/service";
import { failure, readMutation } from "@/shared/infrastructure/http";
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    return NextResponse.json(
      { data: await authenticate(await readMutation(request)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, id);
  }
}
