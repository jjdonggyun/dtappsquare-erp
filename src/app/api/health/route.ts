import { NextResponse } from "next/server";
import { provisioningClient } from "@/shared/infrastructure/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const { data, error } = await provisioningClient().rpc("system_health");
  const healthy = !error && data === true;
  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      database: healthy ? "ready" : "unavailable",
      responseMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
