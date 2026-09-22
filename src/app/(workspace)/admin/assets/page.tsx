import Link from "next/link";
import { Boxes, CircleCheck, Laptop, UserRoundCheck } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { assetCatalog } from "@/modules/asset/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { assetStatuses, assetStatusLabels, assetTypes, assetTypeLabels } from "@/modules/asset/domain/contracts";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AssetManagementPage() {
  const account = await requirePage("ASSET_READ");
  const [data,catalogs] = await Promise.all([assetCatalog(),organizationCatalogs()]);
  const canWrite = account.permissions.includes("ASSET_WRITE");
  const activeAssignments = data.assignments.filter((row) => !row.returned_at);
  const assignee = new Map(activeAssignments.map((row) => [row.asset_id,row.user_id]));
  const people = new Map(catalogs.directory.map((person) => [person.id,person.name]));
  const assignable = data.assets.filter((asset) => ["AVAILABLE","RETURNED"].includes(asset.status) && !assignee.has(asset.id));
  const stats = [
    { label: "전체 자산", value: data.assets.length, Icon: Boxes },
    { label: "지급 가능", value: data.assets.filter((row) => ["AVAILABLE", "RETURNED"].includes(row.status)).length, Icon: CircleCheck },
    { label: "지급 중", value: activeAssignments.length, Icon: UserRoundCheck },
    { label: "등록 장치", value: data.devices.filter((row) => row.active).length, Icon: Laptop },
  ];
  return <>
    <PageHeading eyebrow="ASSET OPERATIONS" title="자산관리" description="자산 원장과 지급·반납 이력을 분리해 전 생애주기를 관리합니다."/>
    <div className="mb-6 grid gap-4 sm:grid-cols-4">
      {stats.map(({ label, value, Icon }) => <Card key={label}><CardContent><Icon size={19} className="mb-4 text-primary"/><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></CardContent></Card>)}
    </div>
    {canWrite ? <div className="mb-6 grid items-start gap-5 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>새 자산 등록</CardTitle></CardHeader><CardContent><CommandForm endpoint="/api/asset-device" action="asset.save" fields={[
        {name:"asset_code",label:"자산 코드",required:true},
        {name:"asset_type",label:"자산 유형",type:"select",required:true,options:assetTypes.map(value=>({value,label:assetTypeLabels[value]}))},
        {name:"manufacturer",label:"제조사"},{name:"model",label:"모델"},{name:"serial_number",label:"일련번호"},
        {name:"purchase_date",label:"구매일",type:"date"},{name:"warranty_end_date",label:"보증 종료일",type:"date"},
        {name:"status",label:"상태",type:"select",value:"AVAILABLE",required:true,options:assetStatuses.filter(value=>value!=="ASSIGNED").map(value=>({value,label:assetStatusLabels[value]}))},
        {name:"memo",label:"메모"},
      ]} submit="자산 등록"/></CardContent></Card>
      <Card><CardHeader><CardTitle>자산 지급</CardTitle></CardHeader><CardContent><CommandForm endpoint="/api/asset-device" action="asset.assign" fields={[
        {name:"asset_id",label:"지급 자산",type:"select",required:true,options:assignable.map(asset=>({value:asset.id,label:`${asset.asset_code} · ${asset.model ?? assetTypeLabels[asset.asset_type as keyof typeof assetTypeLabels]}`}))},
        {name:"user_id",label:"직원",type:"select",required:true,options:catalogs.directory.map(person=>({value:person.id,label:person.name}))},
        {name:"memo",label:"지급 메모"},
      ]} submit="자산 지급"/></CardContent></Card>
    </div> : null}
    <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><CardTitle>자산 원장</CardTitle></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">자산 코드</TableHead><TableHead>유형 / 모델</TableHead><TableHead>일련번호</TableHead><TableHead>현재 사용자</TableHead><TableHead>상태</TableHead></TableRow></TableHeader><TableBody>{data.assets.map(asset=><TableRow key={asset.id}><TableCell className="pl-5"><Link href={`/admin/assets/${asset.id}`} className="font-semibold hover:text-primary">{asset.asset_code}</Link></TableCell><TableCell>{assetTypeLabels[asset.asset_type as keyof typeof assetTypeLabels]}<p className="mt-1 text-[10px] text-muted-foreground">{[asset.manufacturer,asset.model].filter(Boolean).join(" ")||"—"}</p></TableCell><TableCell>{asset.serial_number??"—"}</TableCell><TableCell>{people.get(assignee.get(asset.id)??"")??"—"}</TableCell><TableCell><Badge variant="outline">{assetStatusLabels[asset.status as keyof typeof assetStatusLabels]}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </>;
}
