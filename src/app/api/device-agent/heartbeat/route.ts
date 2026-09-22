import { NextResponse } from "next/server";
import { heartbeatSchema } from "@/modules/device/domain/contracts";
import { provisioningClient } from "@/shared/infrastructure/supabase/admin";
import { databaseError } from "@/shared/domain/errors";
import { failure, readExternalJson } from "@/shared/infrastructure/http";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const input = heartbeatSchema.parse(await readExternalJson(request, 8192));
    const client = provisioningClient();
    const { data, error } = await client.rpc("device_agent_heartbeat", {
      p_device_id: input.device_id,
      p_device_token: input.device_token,
      p_payload: {
        hostname: input.hostname,
        mac_address: input.mac_address,
        os: input.os,
      },
    });
    if (error) throw databaseError(error);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}
