import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).default("");
const optionalEmail = z.union([z.literal(""), z.email()]).default("");
const optionalId = z.union([z.literal(""), z.uuid()]).optional();

export const customerStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const customerStatusLabels: Record<(typeof customerStatuses)[number], string> = {
  ACTIVE: "거래 중",
  INACTIVE: "거래 중지",
  ARCHIVED: "보관",
};

export const contactTypes = ["GENERAL", "BILLING", "CONTRACT", "PROJECT"] as const;
export const contactTypeLabels: Record<(typeof contactTypes)[number], string> = {
  GENERAL: "일반",
  BILLING: "세금계산서",
  CONTRACT: "계약",
  PROJECT: "프로젝트",
};

const customerSave = z.object({
  action: z.literal("customer.save"),
  payload: z.object({
    id: optionalId,
    version: z.number().int().positive().optional(),
    customer_code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().trim().min(1).max(160),
    business_registration_number: z
      .string()
      .trim()
      .regex(/^(?:\d{10}|\d{3}-\d{2}-\d{5})?$/)
      .default(""),
    representative_name: optionalText(100),
    address: optionalText(500),
    business_type: optionalText(120),
    business_item: optionalText(120),
    billing_contact_name: optionalText(100),
    billing_email: optionalEmail,
    payment_terms: optionalText(500),
    default_payment_terms: optionalText(500),
    note: optionalText(4000),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  }),
});

const contactSave = z.object({
  action: z.literal("contact.save"),
  payload: z.object({
    id: optionalId,
    customer_id: z.uuid(),
    version: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(100),
    department: optionalText(100),
    position: optionalText(100),
    phone: optionalText(80),
    email: optionalEmail,
    contact_type: z.enum(contactTypes).default("GENERAL"),
    is_primary: z.boolean().default(false),
    active: z.boolean().default(true),
  }),
});

export const customerCommandSchema = z.discriminatedUnion("action", [
  customerSave,
  z.object({
    action: z.literal("customer.archive"),
    payload: z.object({ id: z.uuid(), version: z.number().int().positive() }),
  }),
  contactSave,
  z.object({
    action: z.literal("contact.archive"),
    payload: z.object({
      id: z.uuid(),
      customer_id: z.uuid(),
      version: z.number().int().positive(),
    }),
  }),
]);

export type CustomerCommand = z.infer<typeof customerCommandSchema>;
