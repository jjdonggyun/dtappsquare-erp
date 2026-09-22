import { requirePage } from "@/shared/auth/account";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { notificationUnreadCount } from "@/modules/notification/infrastructure/repository";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await requirePage();
  const unreadNotifications = account.permissions.includes("NOTIFICATION_READ_SELF")
    ? await notificationUnreadCount()
    : 0;
  return (
    <WorkspaceShell
      name={account.name}
      permissions={account.permissions}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </WorkspaceShell>
  );
}
