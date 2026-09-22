import {NextResponse} from "next/server";
import {z} from "zod";
import {currentAccount} from "@/shared/auth/account";
import {authorize} from "@/modules/rbac/domain/policy";
import {failure,readMutation} from "@/shared/infrastructure/http";
import {staffingCandidates} from "@/modules/workforce-profile/infrastructure/repository";
const inputSchema=z.object({requirementId:z.uuid(),organizationId:z.uuid().optional(),positionId:z.uuid().optional(),skillId:z.uuid().optional(),minCareerMonths:z.number().int().min(0).max(720).optional(),minAvailability:z.number().min(0).max(100).optional()});
export async function POST(request:Request){const requestId=crypto.randomUUID();try{const [account,input]=await Promise.all([currentAccount(),readMutation(request)]);authorize(account,"WORKFORCE_PROFILE_STAFFING_READ");const data=await staffingCandidates(inputSchema.parse(input));return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error,requestId)}}
