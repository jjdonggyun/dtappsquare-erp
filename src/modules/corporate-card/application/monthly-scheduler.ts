import "server-only";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {databaseError} from "@/shared/domain/errors";
import {provisioningClient} from "@/shared/infrastructure/supabase/admin";
import {settlementSchema,settingSchema} from "../infrastructure/repository";
import {storeSettlementExcel} from "../infrastructure/private-storage";
export async function runMonthlyCardSettlement(now=new Date()){
 const client=provisioningClient();const settingResult=await client.from("company_settings").select("value,version,updated_at").eq("key","corporate_card.settlement").single();if(settingResult.error)throw databaseError(settingResult.error);const setting=settingSchema.parse(settingResult.data).value;
 if(!setting.enabled)return {status:"DISABLED"};
 const date=dateInTimeZone(now,setting.timezone);const clock=new Intl.DateTimeFormat("en-GB",{timeZone:setting.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);
 if(Number(date.slice(8,10))<setting.send_day||Number(date.slice(8,10))===setting.send_day&&clock<setting.send_time)return {status:"NOT_DUE"};
 const previous=new Date(`${date.slice(0,7)}-01T00:00:00Z`);previous.setUTCMonth(previous.getUTCMonth()-1);const month=previous.toISOString().slice(0,10);
 async function call(action:string,payload:Record<string,string|number|boolean|null>){const result=await client.rpc("corporate_card_command",{p_action:action,p_payload:payload,p_request_id:crypto.randomUUID()});if(result.error)throw databaseError(result.error);return result.data}
 let result=await client.from("monthly_card_reports").select("*").eq("settlement_month",month).maybeSingle();if(result.error)throw databaseError(result.error);let report=result.data?settlementSchema.parse(result.data):null;
 if(!report||report.status==="DRAFT"||report.status==="REVIEW"){await call("settlement.generate",{settlement_month:month});result=await client.from("monthly_card_reports").select("*").eq("settlement_month",month).single();if(result.error)throw databaseError(result.error);report=settlementSchema.parse(result.data)}
 if(report.status==="SENT")return {status:"SENT",month,reportId:report.id};
 if(!report.file_key){const file=await storeSettlementExcel(report);await call("settlement.file",{settlement_month:month,file_key:file.fileKey,checksum:file.checksum});report={...report,file_key:file.fileKey,checksum:file.checksum}}
 if(report.status==="DRAFT")await call("settlement.transition",{settlement_month:month,status:"REVIEW"});
 if(report.status==="DRAFT"||report.status==="REVIEW")await call("settlement.transition",{settlement_month:month,status:"CLOSED"});
 await call("settlement.queue",{settlement_month:month});return {status:"QUEUED",month,reportId:report.id};
}
