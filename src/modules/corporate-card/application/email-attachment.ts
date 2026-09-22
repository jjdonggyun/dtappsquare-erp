import "server-only";
import {createHash} from "node:crypto";
import {provisioningClient} from "@/shared/infrastructure/supabase/admin";
import {EmailProviderError} from "@/modules/notification/application/email-provider";
import {downloadSettlementExcel} from "../infrastructure/private-storage";
export async function corporateCardEmailAttachment(reportId:string,fileKey:string){const client=provisioningClient();const report=await client.from("monthly_card_reports").select("file_key,checksum,settlement_month").eq("id",reportId).single();if(report.error||!report.data||report.data.file_key!==fileKey||!report.data.checksum)throw new EmailProviderError("CONFIGURATION_ERROR");const content=await downloadSettlementExcel(fileKey);if(createHash("sha256").update(content).digest("hex")!==report.data.checksum)throw new EmailProviderError("CONFIGURATION_ERROR");return {filename:`DigitalSquare_CorporateCard_${report.data.settlement_month.slice(0,7)}.xlsx`,content,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}}
