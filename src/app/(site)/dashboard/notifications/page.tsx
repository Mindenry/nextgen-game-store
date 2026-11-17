import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { many } from "@/lib/db";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/account";
import { formatDate } from "@/lib/utils";
import { Badge, buttonClass, EmptyState } from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/dashboard/notifications");
  const notifications = await many<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }>(
    "select id, type, title, body, link, read_at, created_at from notifications where user_id = $1 order by created_at desc limit 100",
    [user.id],
  );
  const unread = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Inbox</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted">{unread} unread update(s).</p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className={buttonClass({ variant: "outline", size: "sm" })}>
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="size-5" />} title="No notifications yet" description="Order and payment updates will appear here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`surface-card p-4 ${notification.read_at ? "" : "border-primary/25 bg-primary/[0.03]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-fg">{notification.title}</p>
                    <Badge tone="outline" className="capitalize">{notification.type.replaceAll("_", " ")}</Badge>
                    {!notification.read_at ? <Badge tone="primary">New</Badge> : null}
                  </div>
                  {notification.body ? <p className="mt-1 text-xs leading-relaxed text-muted">{notification.body}</p> : null}
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-[10px] text-muted">{formatDate(notification.created_at, true)}</span>
                    {notification.link ? (
                      <Link href={notification.link} className="text-[10px] font-semibold text-primary hover:underline">
                        Open →
                      </Link>
                    ) : null}
                  </div>
                </div>
                {!notification.read_at ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={notification.id} />
                    <button type="submit" className="text-[10px] font-medium text-muted hover:text-fg">
                      Mark read
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
