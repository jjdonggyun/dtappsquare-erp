import { PackageCheck, PackageOpen, RotateCcw } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { assetCatalog } from "@/modules/asset/infrastructure/repository";
import { assetStatusLabels, assetTypeLabels } from "@/modules/asset/domain/contracts";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function MyAssetsPage() {
  const account = await requirePage("ASSET_READ_SELF");
  const data = await assetCatalog();
  const assets = new Map(data.assets.map((asset) => [asset.id, asset]));
  const assignments = data.assignments.filter((row) => row.user_id === account.id);
  const current = assignments.filter((row) => !row.returned_at);
  return (
    <>
      <PageHeading eyebrow="MY ASSETS" title="내 자산" description="현재 지급된 자산과 과거 반납 이력을 확인합니다." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent><PackageCheck className="mb-4 text-primary" size={20}/><p className="text-xs text-muted-foreground">현재 지급</p><p className="mt-2 text-2xl font-bold">{current.length}<span className="ml-1 text-xs font-normal">대</span></p></CardContent></Card>
        <Card><CardContent><RotateCcw className="mb-4 text-primary" size={20}/><p className="text-xs text-muted-foreground">반납 이력</p><p className="mt-2 text-2xl font-bold">{assignments.length-current.length}<span className="ml-1 text-xs font-normal">건</span></p></CardContent></Card>
        <Card><CardContent><PackageOpen className="mb-4 text-primary" size={20}/><p className="text-xs text-muted-foreground">전체 지급 이력</p><p className="mt-2 text-2xl font-bold">{assignments.length}<span className="ml-1 text-xs font-normal">건</span></p></CardContent></Card>
      </div>
      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow><TableHead className="pl-5">자산</TableHead><TableHead>유형</TableHead><TableHead>지급일</TableHead><TableHead>반납일</TableHead><TableHead>상태</TableHead></TableRow></TableHeader>
            <TableBody>{assignments.map((assignment) => {
              const asset = assets.get(assignment.asset_id);
              return <TableRow key={assignment.id}><TableCell className="pl-5 font-semibold">{asset?.asset_code ?? "—"}<p className="mt-1 text-[10px] font-normal text-muted-foreground">{[asset?.manufacturer,asset?.model].filter(Boolean).join(" ")}</p></TableCell><TableCell>{asset ? assetTypeLabels[asset.asset_type as keyof typeof assetTypeLabels] : "—"}</TableCell><TableCell>{new Date(assignment.assigned_at).toLocaleDateString("ko-KR")}</TableCell><TableCell>{assignment.returned_at ? new Date(assignment.returned_at).toLocaleDateString("ko-KR") : "현재"}</TableCell><TableCell><Badge variant="outline">{assignment.returned_at ? "반납" : asset ? assetStatusLabels[asset.status as keyof typeof assetStatusLabels] : "지급"}</Badge></TableCell></TableRow>;
            })}</TableBody>
          </Table>
          {!assignments.length ? <p className="py-16 text-center text-xs text-muted-foreground">지급 이력이 없습니다.</p> : null}
        </CardContent>
      </Card>
    </>
  );
}
