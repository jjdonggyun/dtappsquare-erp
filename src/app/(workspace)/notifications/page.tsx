import Link from "next/link";
import { ArrowUpRight, Bell, CircleCheck } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { notificationList } from "@/modules/notification/infrastructure/repository";
import { notificationActionPath } from "@/modules/navigation/domain/navigation";
import { PageHeading } from "@/components/page-heading";
import { EmptyState } from "@/components/page-state";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function NotificationsPage() {
  await requirePage("NOTIFICATION_READ_SELF");
  const rows = await notificationList();
  const unread = rows.filter((row) => !row.read_at).length;

  return (
    <>
      <PageHeading eyebrow="NOTIFICATIONS" title="알림" description={`업무 이벤트로 생성된 인앱 알림입니다. 읽지 않은 알림 ${unread}건입니다.`} />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => {
            const actionPath = notificationActionPath(row.reference_type, row.reference_id);
            return (
              <Card key={row.id} className={row.read_at ? "opacity-70" : "border-primary/25"}>
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  <span className={`flex size-10 items-center justify-center rounded-full ${row.read_at ? "bg-muted" : "bg-brand-soft text-primary"}`}>
                    {row.read_at ? <CircleCheck size={18} /> : <Bell size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{row.title}</p>
                      {!row.read_at && <Badge className="bg-primary">NEW</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{row.message}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {actionPath ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={actionPath}>업무 열기 <ArrowUpRight size={13} /></Link>
                      </Button>
                    ) : null}
                    {!row.read_at && <CommandForm endpoint="/api/leave-approval" action="notification.read" constants={{ id: row.id }} fields={[]} submit="읽음" />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="새 알림이 없습니다." description="결재, 프로젝트, 비용과 재무 업무 이벤트가 발생하면 여기에 표시됩니다." />
      )}
    </>
  );
}
