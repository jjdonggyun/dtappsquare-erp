import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

export const assetSchema = z.object({
  id: z.uuid(),
  asset_code: z.string(),
  asset_type: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  purchase_date: z.string().nullable(),
  warranty_end_date: z.string().nullable(),
  status: z.string(),
  memo: z.string().nullable(),
  version: z.number().int(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const assetAssignmentSchema = z.object({
  id: z.uuid(),
  asset_id: z.uuid(),
  user_id: z.uuid(),
  assigned_at: z.string(),
  returned_at: z.string().nullable(),
  assigned_by: z.uuid(),
  returned_by: z.uuid().nullable(),
  return_condition: z.string().nullable(),
  memo: z.string().nullable(),
  created_at: z.string(),
});

const deviceSchema = z.object({
  id: z.uuid(),
  device_id: z.uuid(),
  asset_id: z.uuid(),
  hostname: z.string(),
  serial_number: z.string(),
  os: z.string(),
  registered_at: z.string(),
  last_seen_at: z.string().nullable(),
  active: z.boolean(),
  version: z.number().int(),
  updated_at: z.string(),
});

export async function assetCatalog() {
  const client = await serverClient();
  const [assets, assignments, devices] = await Promise.all([
    client.from("assets").select("id,asset_code,asset_type,manufacturer,model,serial_number,purchase_date,warranty_end_date,status,memo,version,archived_at,created_at,updated_at").order("asset_code").limit(1000),
    client.from("asset_assignments").select("*").order("assigned_at", { ascending: false }).limit(2000),
    client.from("registered_devices").select("id,device_id,asset_id,hostname,serial_number,os,registered_at,last_seen_at,active,version,updated_at").order("registered_at", { ascending: false }).limit(1000),
  ]);
  if (assets.error) throw databaseError(assets.error);
  if (assignments.error) throw databaseError(assignments.error);
  if (devices.error) throw databaseError(devices.error);
  return {
    assets: assetSchema.array().parse(assets.data),
    assignments: assetAssignmentSchema.array().parse(assignments.data),
    devices: deviceSchema.array().parse(devices.data),
  };
}

export async function assetDetail(id: string) {
  const data = await assetCatalog();
  const asset = data.assets.find((row) => row.id === id);
  return asset
    ? {
        asset,
        assignments: data.assignments.filter((row) => row.asset_id === id),
        device: data.devices.find((row) => row.asset_id === id) ?? null,
      }
    : null;
}
