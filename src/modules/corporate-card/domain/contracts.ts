import {z} from "zod";
const optionalId=z.union([z.literal(""),z.uuid()]).optional();
const positiveVersion=z.number().int().positive().optional();
const month=z.iso.date();
export const expenseCategories=["TRANSPORT","MEAL","MEETING","SUPPLIES","ACCOMMODATION","ENTERTAINMENT","ETC"] as const;
export const expenseCategoryLabels:Record<(typeof expenseCategories)[number],string>={TRANSPORT:"교통",MEAL:"식비",MEETING:"회의",SUPPLIES:"소모품",ACCOMMODATION:"숙박",ENTERTAINMENT:"접대",ETC:"기타"};
export const corporateCardCommands=z.discriminatedUnion("action",[
 z.object({action:z.literal("card.save"),payload:z.object({id:optionalId,version:positiveVersion,card_name:z.string().trim().min(1).max(120),card_company:z.string().trim().min(1).max(120),identifier:z.string().trim().min(1).max(100),last_four:z.string().regex(/^\d{4}$/),status:z.enum(["ACTIVE","INACTIVE","LOST"]),memo:z.string().max(2000).default("")})}),
 z.object({action:z.literal("card_assignment.save"),payload:z.object({id:optionalId,version:positiveVersion,corporate_card_id:z.uuid(),project_id:z.uuid(),responsible_user_id:z.uuid(),assigned_from:z.iso.date(),assigned_to:z.union([z.literal(""),z.iso.date()]).default(""),status:z.enum(["ACTIVE","ENDED"]),memo:z.string().max(2000).default("")})}),
 z.object({action:z.literal("expense.save"),payload:z.object({id:optionalId,version:positiveVersion,transaction_date:z.iso.date(),project_id:z.uuid(),corporate_card_id:z.uuid(),merchant:z.string().trim().min(1).max(200),purpose:z.string().trim().min(1).max(500),category:z.enum(expenseCategories),supply_amount:z.number().min(0).max(999999999999.99),vat_amount:z.number().min(0).max(999999999999.99),memo:z.string().max(2000).default("")})}),
 z.object({action:z.literal("expense.delete"),payload:z.object({id:z.uuid(),version:z.number().int().positive()})}),
 z.object({action:z.literal("expense.receipt"),payload:z.object({id:z.uuid(),version:z.number().int().positive(),receipt_key:z.string().min(3).max(500)})}),
 z.object({action:z.literal("settlement.setting"),payload:z.object({version:z.number().int().positive(),enabled:z.boolean(),recipients:z.array(z.email()).max(20),cc:z.array(z.email()).max(20),send_day:z.number().int().min(1).max(28),send_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),timezone:z.literal("Asia/Seoul"),subject_template:z.string().min(1).max(160)})}),
 z.object({action:z.literal("settlement.generate"),payload:z.object({settlement_month:month,version:positiveVersion})}),
 z.object({action:z.literal("settlement.transition"),payload:z.object({settlement_month:month,version:positiveVersion,status:z.enum(["DRAFT","REVIEW","CLOSED"])})}),
 z.object({action:z.literal("settlement.queue"),payload:z.object({settlement_month:month,version:positiveVersion,force:z.boolean().optional(),resend:z.boolean().optional()})}),
]);
export type CorporateCardCommand=z.infer<typeof corporateCardCommands>;
