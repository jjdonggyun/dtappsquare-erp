import {NextResponse} from "next/server";
import {currentAccount} from "@/shared/auth/account";
import {executeWorkManagement} from "@/modules/work-management/application/commands";
import {workManagementRepository} from "@/modules/work-management/infrastructure/repository";
import {failure,readMutation} from "@/shared/infrastructure/http";
export async function POST(request:Request){const requestId=crypto.randomUUID();try{const [account,input]=await Promise.all([currentAccount(),readMutation(request)]);const data=await executeWorkManagement(account,input,workManagementRepository(),requestId);return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error,requestId)}}
