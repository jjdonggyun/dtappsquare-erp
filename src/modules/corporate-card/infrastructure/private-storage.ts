import "server-only";
import {createHash} from "node:crypto";
import {provisioningClient} from "@/shared/infrastructure/supabase/admin";
import {buildSettlementExcel} from "../application/settlement-excel";
import type {z} from "zod";
import type {settlementSchema} from "./repository";
type Report=z.infer<typeof settlementSchema>;
export async function storeSettlementExcel(report:Report){const content=await buildSettlementExcel(report);const checksum=createHash("sha256").update(content).digest("hex");const filename=`DigitalSquare_CorporateCard_${report.settlement_month.slice(0,7)}.xlsx`;const fileKey=`${report.id}/${checksum}/${filename}`;const client=provisioningClient();const bucket=client.storage.from("card-settlements");const {error}=await bucket.upload(fileKey,content,{contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",upsert:false});if(error){const existing=await bucket.download(fileKey);if(existing.error)throw error;const stored=Buffer.from(await existing.data.arrayBuffer());if(createHash("sha256").update(stored).digest("hex")!==checksum)throw error}return {fileKey,checksum,filename,content}}
export async function downloadSettlementExcel(fileKey:string){const {data,error}=await provisioningClient().storage.from("card-settlements").download(fileKey);if(error)throw error;return Buffer.from(await data.arrayBuffer())}
