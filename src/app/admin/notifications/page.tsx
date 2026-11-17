import { BellRing, Send } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { many } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Card, Input, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { broadcastNotificationAction } from "@/actions/admin-content";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.notificationsManage)) return <AccessDenied permission={PERMISSIONS.notificationsManage} />;
  const recent = await many<{ id: string; title: string; body: string | null; created_at: string; email: string; read_at: string | null }>(
    `select n.id, n.title, n.body, n.created_at, p.email, n.read_at
     from notifications n join profiles p on p.id = n.user_id
     order by n.created_at desc limit 30`,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Engagement"
        title="Notifications"
        description="Broadcast in-app announcements to every active customer. Transactional notifications are sent automatically by orders and payments."
      />

      <div className="grid gap-4 lg:grid-cols-[420px_1fr] lg:items-start">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><BellRing className="size-4 text-primary" /> Send announcement</h2>
          <div className="mt-3">
            <AdminActionForm action={broadcastNotificationAction} submitLabel="Send to all customers">
              <Input name="title" required minLength={3} maxLength={100} placeholder="Announcement title" />
              <Textarea name="body" rows={4} maxLength={500} placeholder="Message body" className="mt-2" />
              <Input name="link" placeholder="/products (optional link)" className="mt-2" />
            </AdminActionForm>
          </div>
          <p className="mt-3 text-[10px] text-muted">Delivery is in-app only; no email is sent unless the email adapter is configured separately.</p>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Recent notifications</h2>
          <div className="mt-3 max-h-[560px] space-y-1.5 overflow-y-auto">
            {recent.map((notification) => (
              <div key={notification.id} className="rounded-lg border border-border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold text-fg">{notification.title}</p>
                  <span className="shrink-0 text-[9px] text-muted">{formatDate(notification.created_at, true)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-muted">{notification.body}</p>
                <p className="mt-1 text-[9px] text-muted">{notification.email} · {notification.read_at ? "read" : "unread"}</p>
              </div>
            ))}
            {recent.length === 0 ? <p className="text-xs text-muted">No notifications sent yet.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
