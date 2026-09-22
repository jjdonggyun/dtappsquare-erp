import { Bell, CircleCheck } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { notificationList } from "@/modules/notification/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function NotificationsPage() {
  await requirePage("NOTIFICATION_READ_SELF");
  const rows = await notificationList();
  return <><PageHeading eyebrow="NOTIFICATIONS" title="알림" description={`업무 이벤트로 생성된 인앱 알림입니다. 읽지 않은 알림 ${rows.filter((row) => !row.read_at).length}건입니다.`}/><div className="space-y-3">{rows.map((row) => <Card key={row.id} className={row.read_at ? "opacity-70" : "border-primary/25"}><CardContent className="flex flex-wrap items-center gap-4 py-4"><span className={`flex size-10 items-center justify-center rounded-full ${row.read_at ? "bg-muted" : "bg-brand-soft text-primary"}`}>{row.read_at ? <CircleCheck size={18}/> : <Bell size={18}/>}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-semibold">{row.title}</p>{!row.read_at && <Badge className="bg-primary">NEW</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{row.message}</p><p className="mt-2 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}</p></div>{!row.read_at && <CommandForm endpoint="/api/leave-approval" action="notification.read" constants={{ id: row.id }} fields={[]} submit="읽음"/>}</CardContent></Card>)}{!rows.length && <Card><CardContent className="py-16 text-center text-xs text-muted-foreground">새 알림이 없습니다.</CardContent></Card>}</div></>;
}
