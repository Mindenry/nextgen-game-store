import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { one } from "@/lib/db";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-provider";
import { Badge, buttonClass } from "@/components/ui";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff("/admin");
  const counts = await one<{ reviews: number; orders: number; tickets: number; payments: number }>(
    `select
       (select count(*)::int from reviews where status = 'pending') as reviews,
       (select count(*)::int from orders where status in ('paid','processing')) as orders,
       (select count(*)::int from support_tickets where status = 'open') as tickets,
       (select count(*)::int from payments where status = 'MANUAL_REVIEW') as payments`,
  );

  const all: (AdminNavItem & { permission: string | null })[] = [
    { href: "/admin", label: "Overview", icon: "dashboard", permission: PERMISSIONS.dashboardView },
    { href: "/admin/analytics", label: "Analytics", icon: "analytics", permission: PERMISSIONS.analyticsView },
    { href: "/admin/orders", label: "Orders", icon: "orders", badge: Number(counts?.orders ?? 0), permission: PERMISSIONS.ordersView },
    { href: "/admin/products", label: "Products", icon: "products", permission: PERMISSIONS.productsView },
    { href: "/admin/categories", label: "Categories", icon: "categories", permission: PERMISSIONS.categoriesManage },
    { href: "/admin/topup", label: "Game Top-Up", icon: "topup", permission: PERMISSIONS.topupView },
    { href: "/admin/inventory", label: "Inventory", icon: "inventory", permission: PERMISSIONS.inventoryView },
    { href: "/admin/wallet", label: "Wallets", icon: "wallet", permission: PERMISSIONS.walletAdjust },
    { href: "/admin/payments", label: "Payments", icon: "payments", badge: Number(counts?.payments ?? 0), permission: PERMISSIONS.paymentsView },
    { href: "/admin/payment-settings", label: "Payment Settings", icon: "settings", permission: PERMISSIONS.settingsManage },
    { href: "/admin/payment-providers", label: "Payment Providers", icon: "providers", permission: PERMISSIONS.paymentsProviders },
    { href: "/admin/customers", label: "Customers", icon: "customers", permission: PERMISSIONS.customersView },
    { href: "/admin/coupons", label: "Coupons", icon: "coupons", permission: PERMISSIONS.couponsManage },
    { href: "/admin/promotions", label: "Promotions", icon: "promotions", permission: PERMISSIONS.promotionsManage },
    { href: "/admin/banners", label: "Banner Management", icon: "banners", permission: PERMISSIONS.bannersManage },
    { href: "/admin/reviews", label: "Reviews", icon: "reviews", badge: Number(counts?.reviews ?? 0), permission: PERMISSIONS.reviewsManage },
    { href: "/admin/support", label: "Support Tickets", icon: "support", badge: Number(counts?.tickets ?? 0), permission: PERMISSIONS.supportView },
    { href: "/admin/notifications", label: "Notifications", icon: "notifications", permission: PERMISSIONS.notificationsManage },
    { href: "/admin/staff", label: "Staff Management", icon: "staff", permission: PERMISSIONS.staffManage },
    { href: "/admin/roles", label: "Roles & Permissions", icon: "roles", permission: PERMISSIONS.rolesManage },
    { href: "/admin/audit", label: "Audit Logs", icon: "audit", permission: PERMISSIONS.auditView },
    { href: "/admin/settings", label: "Settings", icon: "settings", permission: PERMISSIONS.settingsManage },
  ];
  const items: AdminNavItem[] = all
    .filter((item) => item.permission === null || can(user, item.permission))
    .map(({ permission: _permission, ...item }) => item);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <Brand compact href="/admin" />
            <span className="hidden items-baseline gap-2 sm:flex">
              <span className="font-display text-sm font-bold tracking-wide text-fg">NEXTGEN</span>
              <Badge tone="primary" className="text-[9px]">ADMIN</Badge>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className={buttonClass({ variant: "ghost", size: "sm" })}>
              <Store className="size-3.5" /> View store <ArrowUpRight className="size-3" />
            </Link>
            <ThemeToggle className="size-8" />
            <UserMenu displayName={user.displayName} email={user.email} roleId={user.roleId} avatarUrl={user.avatarUrl} />
          </div>
        </div>
        <div className="border-t border-border px-3 py-2 lg:hidden">
          <AdminNav items={items} />
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-card/60 p-3 lg:block">
          <div className="mb-3 rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Signed in as</p>
            <p className="mt-1 truncate text-xs font-semibold text-fg">{user.displayName}</p>
            <p className="truncate text-[10px] capitalize text-muted">{user.roleName}</p>
          </div>
          <AdminNav items={items} />
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
