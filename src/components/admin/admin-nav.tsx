"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  BarChart3,
  BellRing,
  Boxes,
  CreditCard,
  FileClock,
  Gamepad2,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  TicketPercent,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  orders: ReceiptText,
  products: ShoppingBag,
  categories: PackageSearch,
  topup: Gamepad2,
  inventory: Boxes,
  wallet: Wallet,
  payments: CreditCard,
  providers: ShieldCheck,
  customers: Users,
  coupons: TicketPercent,
  promotions: Megaphone,
  banners: ImageIcon,
  reviews: Star,
  support: LifeBuoy,
  notifications: BellRing,
  staff: UserCog,
  roles: BadgePercent,
  audit: FileClock,
  settings: Settings,
  store: Store,
} as const;

export type AdminNavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
            {item.badge ? (
              <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-danger/12 px-1 text-[9px] font-bold text-danger">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
