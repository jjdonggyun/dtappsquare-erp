import {NextResponse} from "next/server";
import {currentAccount} from "@/shared/auth/account";
import {executeCorporateCardCommand} from "@/modules/corporate-card/application/commands";
import {corporateCardRepository} from "@/modules/corporate-card/infrastructure/repository";
import {failure,readMutation} from "@/shared/infrastructure/http";
export async function POST(request:Request){const requestId=crypto.randomUUID();try{const [account,input]=await Promise.all([currentAccount(),readMutation(request)]);const data=await executeCorporateCardCommand(account,input,corporateCardRepository(),requestId);return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error,requestId)}}
