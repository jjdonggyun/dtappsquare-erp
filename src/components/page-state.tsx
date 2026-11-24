import Link from "next/link";
import { AlertTriangle, Ban, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoadingState({ label = "업무 데이터를 불러오고 있습니다…" }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-64 place-items-center" aria-live="polite">
      <div className="text-center text-muted-foreground">
        <LoaderCircle className="mx-auto mb-3 animate-spin" size={24} />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card><CardContent className="flex flex-col items-center py-16 text-center">
      <Inbox className="mb-3 text-muted-foreground" size={24} />
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </CardContent></Card>
  );
}

export function NoPermissionState() {
  return (
    <Card><CardContent className="flex flex-col items-center py-16 text-center">
      <Ban className="mb-3 text-destructive" size={26} />
      <p className="text-base font-semibold">이 화면을 볼 권한이 없습니다.</p>
      <p className="mt-2 text-xs text-muted-foreground">업무상 접근이 필요하면 시스템 관리자에게 역할과 권한을 요청해 주세요.</p>
      <Button asChild className="mt-5"><Link href="/dashboard">대시보드로 이동</Link></Button>
    </CardContent></Card>
  );
}

export function NotFoundState() {
  return (
    <Card><CardContent className="flex flex-col items-center py-16 text-center">
      <AlertTriangle className="mb-3 text-amber-600" size={26} />
      <p className="text-base font-semibold">요청한 업무 화면을 찾을 수 없습니다.</p>
      <p className="mt-2 text-xs text-muted-foreground">주소가 변경되었거나 데이터가 삭제되었을 수 있습니다.</p>
      <Button asChild variant="outline" className="mt-5"><Link href="/dashboard">대시보드로 이동</Link></Button>
    </CardContent></Card>
  );
}
