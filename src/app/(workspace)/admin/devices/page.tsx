import { requirePage } from "@/shared/auth/account";
import { assetCatalog } from "@/modules/asset/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DeviceManagementPage(){
  await requirePage("DEVICE_MANAGE");
  const data=await assetCatalog();
  const assets=new Map(data.assets.map(asset=>[asset.id,asset]));
  const registrable=data.assets.filter(asset=>["LAPTOP","DESKTOP","PHONE","TABLET"].includes(asset.asset_type)&&!data.devices.some(device=>device.asset_id===asset.id));
  return <>
    <PageHeading eyebrow="DEVICE TRUST" title="장치관리" description="Device Agent 연동을 위한 장치 식별자와 토큰 해시를 관리합니다. 원본 토큰은 등록 직후 한 번만 표시됩니다."/>
    <Card className="mb-6"><CardHeader><CardTitle>장치 등록</CardTitle></CardHeader><CardContent><CommandForm endpoint="/api/asset-device" action="device.register" fields={[
      {name:"asset_id",label:"연결 자산",type:"select",required:true,options:registrable.map(asset=>({value:asset.id,label:`${asset.asset_code} · ${asset.model??asset.asset_type}`}))},
      {name:"device_id",label:"Device UUID (비우면 자동 생성)"},{name:"hostname",label:"Hostname",required:true},{name:"serial_number",label:"Serial Number",required:true},{name:"mac_address",label:"MAC Address",required:true},{name:"os",label:"운영체제",required:true},
    ]} submit="장치 등록" sensitiveResultField="device_token" sensitiveResultLabel="Device Agent 토큰 · 지금 안전한 곳에 보관하세요"/></CardContent></Card>
    <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><CardTitle>등록 장치</CardTitle></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">Hostname</TableHead><TableHead>자산</TableHead><TableHead>운영체제</TableHead><TableHead>마지막 통신</TableHead><TableHead>상태</TableHead><TableHead>관리</TableHead></TableRow></TableHeader><TableBody>{data.devices.map(device=><TableRow key={device.id}><TableCell className="pl-5 font-semibold">{device.hostname}<p className="mt-1 text-[10px] font-normal text-muted-foreground">{device.device_id}</p></TableCell><TableCell>{assets.get(device.asset_id)?.asset_code??"—"}</TableCell><TableCell>{device.os}</TableCell><TableCell>{device.last_seen_at?new Date(device.last_seen_at).toLocaleString("ko-KR"):"연결 전"}</TableCell><TableCell><Badge variant="outline">{device.active?"활성":"비활성"}</Badge></TableCell><TableCell><CommandForm endpoint="/api/asset-device" action="device.status" constants={{id:device.id,version:device.version,active:!device.active}} submit={device.active?"비활성화":"활성화"} columns={1}/></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </>;
}
