import { z } from "zod";

export const assetTypes = [
  "LAPTOP",
  "DESKTOP",
  "MONITOR",
  "PHONE",
  "TABLET",
  "LICENSE",
  "ETC",
] as const;

export const assetStatuses = [
  "AVAILABLE",
  "ASSIGNED",
  "IN_USE",
  "REPAIR",
  "LOST",
  "RETURNED",
  "DISPOSED",
] as const;

export const assetTypeLabels: Record<(typeof assetTypes)[number], string> = {
  LAPTOP: "노트북",
  DESKTOP: "데스크톱",
  MONITOR: "모니터",
  PHONE: "휴대전화",
  TABLET: "태블릿",
  LICENSE: "라이선스",
  ETC: "기타",
};

export const assetStatusLabels: Record<(typeof assetStatuses)[number], string> = {
  AVAILABLE: "지급 가능",
  ASSIGNED: "지급됨",
  IN_USE: "사용 중",
  REPAIR: "수리 중",
  LOST: "분실",
  RETURNED: "반납됨",
  DISPOSED: "폐기",
};

const nullableDate = z.union([z.literal(""), z.iso.date()]).default("");

export const assetCommands = [
  z.object({
    action: z.literal("asset.save"),
    payload: z.object({
      id: z.union([z.literal(""), z.uuid()]).optional(),
      version: z.number().int().positive().optional(),
      asset_code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
      asset_type: z.enum(assetTypes),
      manufacturer: z.string().trim().max(100).default(""),
      model: z.string().trim().max(160).default(""),
      serial_number: z.string().trim().max(160).default(""),
      purchase_date: nullableDate,
      warranty_end_date: nullableDate,
      status: z.enum(assetStatuses).default("AVAILABLE"),
      memo: z.string().trim().max(2000).default(""),
    }),
  }),
  z.object({
    action: z.literal("asset.assign"),
    payload: z.object({
      asset_id: z.uuid(),
      user_id: z.uuid(),
      assigned_at: z.string().default(""),
      memo: z.string().trim().max(2000).default(""),
    }),
  }),
  z.object({
    action: z.literal("asset.return"),
    payload: z.object({
      assignment_id: z.uuid(),
      returned_at: z.string().default(""),
      return_condition: z.string().trim().min(2).max(1000),
      memo: z.string().trim().max(2000).default(""),
    }),
  }),
] as const;
