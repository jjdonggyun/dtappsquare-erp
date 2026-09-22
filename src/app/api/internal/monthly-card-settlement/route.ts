import {timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {runMonthlyCardSettlement} from "@/modules/corporate-card/application/monthly-scheduler";
import {scheduleEmailDispatch} from "@/modules/notification/infrastructure/schedule-email-dispatch";
import {AppError} from "@/shared/domain/errors";
import {failure} from "@/shared/infrastructure/http";
function authorized(request:Request){const secret=process.env.CRON_SECRET;const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!secret||secret.length<32||!supplied)return false;const left=Buffer.from(secret),right=Buffer.from(supplied);return left.length===right.length&&timingSafeEqual(left,right)}
export async function GET(request:Request){const requestId=crypto.randomUUID();try{if(!authorized(request))throw new AppError("Unauthorized");const data=await runMonthlyCardSettlement();if(data.status==="QUEUED")scheduleEmailDispatch(requestId);return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error,requestId)}}
