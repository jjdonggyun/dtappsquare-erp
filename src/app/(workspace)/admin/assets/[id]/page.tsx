import { notFound } from "next/navigation";
import { requirePage } from "@/shared/auth/account";
import { assetDetail } from "@/modules/asset/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { assetStatuses, assetStatusLabels, assetTypes, assetTypeLabels } from "@/modules/asset/domain/contracts";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AssetDetailPage({params}:{params:Promise<{id:string}>}) {
  const account = await requirePage("ASSET_READ");
  const {id}=await params;
  const [data,catalogs]=await Promise.all([assetDetail(id),organizationCatalogs()]);
  if(!data) notFound();
  const people=new Map(catalogs.directory.map(person=>[person.id,person.name]));
  const active=data.assignments.find(row=>!row.returned_at);
  return <>
    <PageHeading eyebrow="ASSET DETAIL" title={data.asset.asset_code} description={`${assetTypeLabels[data.asset.asset_type as keyof typeof assetTypeLabels]} · ${[data.asset.manufacturer,data.asset.model].filter(Boolean).join(" ")||"모델 미등록"}`}/>
    <div className="mb-6 grid items-start gap-5 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>자산 정보</CardTitle></CardHeader><CardContent>{account.permissions.includes("ASSET_WRITE")?<CommandForm endpoint="/api/asset-device" action="asset.save" constants={{id:data.asset.id,version:data.asset.version}} fields={[
        {name:"asset_code",label:"자산 코드",value:data.asset.asset_code,required:true},
        {name:"asset_type",label:"유형",type:"select",value:data.asset.asset_type,required:true,options:assetTypes.map(value=>({value,label:assetTypeLabels[value]}))},
        {name:"manufacturer",label:"제조사",value:data.asset.manufacturer??""},{name:"model",label:"모델",value:data.asset.model??""},{name:"serial_number",label:"일련번호",value:data.asset.serial_number??""},
        {name:"purchase_date",label:"구매일",type:"date",value:data.asset.purchase_date??""},{name:"warranty_end_date",label:"보증 종료",type:"date",value:data.asset.warranty_end_date??""},
        {name:"status",label:"상태",type:"select",value:data.asset.status,required:true,options:assetStatuses.map(value=>({value,label:assetStatusLabels[value]}))},{name:"memo",label:"메모",value:data.asset.memo??""},
      ]} submit="자산 정보 저장"/>:<Badge variant="outline">{assetStatusLabels[data.asset.status as keyof typeof assetStatusLabels]}</Badge>}</CardContent></Card>
      <Card><CardHeader><CardTitle>현재 지급 / 장치</CardTitle></CardHeader><CardContent className="space-y-5"><div className="rounded-md border bg-muted/30 p-4 text-sm"><p className="text-xs text-muted-foreground">현재 사용자</p><p className="mt-2 font-semibold">{active?people.get(active.user_id)??"조회 제한":"미지급"}</p></div>{data.device?<div className="rounded-md border bg-muted/30 p-4 text-sm"><p className="text-xs text-muted-foreground">등록 장치</p><p className="mt-2 font-semibold">{data.device.hostname}</p><p className="mt-1 text-xs text-muted-foreground">{data.device.os} · {data.device.active?"활성":"비활성"}</p></div>:<p className="text-xs text-muted-foreground">연결된 등록 장치가 없습니다.</p>}</CardContent></Card>
    </div>
    <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><CardTitle>지급 이력</CardTitle></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">사용자</TableHead><TableHead>지급일</TableHead><TableHead>반납일</TableHead><TableHead>반납 상태</TableHead><TableHead>처리</TableHead></TableRow></TableHeader><TableBody>{data.assignments.map(row=><TableRow key={row.id}><TableCell className="pl-5 font-semibold">{people.get(row.user_id)??"조회 제한"}</TableCell><TableCell>{new Date(row.assigned_at).toLocaleString("ko-KR")}</TableCell><TableCell>{row.returned_at?new Date(row.returned_at).toLocaleString("ko-KR"):"현재"}</TableCell><TableCell>{row.return_condition??"—"}</TableCell><TableCell>{!row.returned_at&&account.permissions.includes("ASSET_WRITE")?<CommandForm endpoint="/api/asset-device" action="asset.return" constants={{assignment_id:row.id}} fields={[{name:"return_condition",label:"반납 상태",required:true},{name:"memo",label:"메모"}]} submit="반납 처리" columns={1}/>:"—"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </>;
}
