"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";

type Verification={id:string;mode:"OFF"|"DEVICE_ONLY"|"NETWORK_ONLY"|"DEVICE_AND_NETWORK"|"REMOTE_APPROVED";
 status:"PENDING"|"READY"|"FAILED";network_status:"VERIFIED"|"FAILED"|"UNKNOWN"|"EXEMPT"|"NOT_REQUIRED";
 device_status:"UNKNOWN"|"VERIFIED"|"FAILED"|"NOT_REQUIRED"};
export function AttendanceCheckControl({eventType}:{eventType:"CHECK_IN"|"CHECK_OUT"}){
 const router=useRouter();const [verification,setVerification]=useState<Verification|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const requestEvidence=useCallback(async()=>{
  try{
   const response=await fetch("/api/attendance-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_type:eventType})});
   const body=await response.json();if(!response.ok)throw new Error(body.error?.message??"검증을 시작하지 못했습니다.");
   const next=body.data as Verification;setVerification(next);
   if(next.status==="PENDING"&&(next.mode==="DEVICE_ONLY"||next.mode==="DEVICE_AND_NETWORK"||next.mode==="REMOTE_APPROVED"||next.network_status==="EXEMPT")){
    const agent=await fetch("http://127.0.0.1:45873/proof",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({verification_id:next.id})});
    if(!agent.ok)throw new Error("등록된 회사 PC의 Device Agent를 확인해 주세요.");
    setVerification({...next,status:"READY",device_status:"VERIFIED"});
   }
 }catch(error){setMessage(error instanceof Error?error.message:"출퇴근 검증을 확인할 수 없습니다.")}
 finally{setLoading(false)}
 },[eventType]);
 useEffect(()=>{const timer=window.setTimeout(()=>{void requestEvidence()},0);return()=>window.clearTimeout(timer)},[requestEvidence]);
 function prepare(){setLoading(true);setMessage("");setVerification(null);void requestEvidence()}
 async function record(){if(!verification||verification.status!=="READY")return;setBusy(true);setMessage("");try{
  const response=await fetch("/api/workforce",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:eventType==="CHECK_IN"?"attendance.check_in":"attendance.check_out",payload:{verification_id:verification.id}})});
  const body=await response.json();if(!response.ok)throw new Error(body.error?.message??"기록하지 못했습니다.");
  setMessage(body.data?.message??"기록했습니다.");router.refresh();
 }catch(error){setMessage(error instanceof Error?error.message:"출퇴근 기록을 확인해 주세요.");prepare()}finally{setBusy(false)}}
 const ready=verification?.status==="READY";
 const network=verification?.network_status;
 const device=verification?.device_status;
 return <div className="min-w-52 space-y-2 text-xs text-white/85">
  <p className="font-semibold text-white">{loading?"출퇴근 환경 확인 중":ready?"출근 준비 완료":"현재 환경에서 일반 출퇴근을 기록할 수 없습니다"}</p>
  {verification&&<div className="space-y-1 text-[11px]"><p>등록 기기 · {device==="VERIFIED"?"확인":device==="NOT_REQUIRED"?"정책상 불필요":"확인 필요"}</p>
   <p>회사 네트워크 · {network==="VERIFIED"?"확인":network==="EXEMPT"?"승인 예외":network==="NOT_REQUIRED"?"정책상 불필요":"확인 필요"}</p></div>}
  <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" disabled={!ready||busy||loading} onClick={()=>void record()}>{eventType==="CHECK_IN"?"출근 기록":"퇴근 기록"}</Button>
   <Button type="button" size="sm" variant="outline" className="border-white/30 bg-transparent text-white" disabled={busy||loading} onClick={prepare}>다시 확인</Button></div>
  {message&&<p role="status" className="max-w-64 text-[11px] text-white/85">{message}</p>}
 </div>;
}
