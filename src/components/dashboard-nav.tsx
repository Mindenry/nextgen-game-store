"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CreditCard,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Package,
  ReceiptText,
  ShieldCheck,
  TicketPercent,
  UserRound,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/wallet", label: "My Wallet", icon: Wallet },
  { href: "/dashboard/wallet/history", label: "Top-up History", icon: CreditCard },
  { href: "/dashboard/orders", label: "My Orders", icon: ReceiptText },
  { href: "/dashboard/products", label: "My Products", icon: Package },
  { href: "/dashboard/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/dashboard/favorites", label: "Favourites", icon: Heart },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  { href: "/dashboard/security", label: "Security", icon: ShieldCheck },
];

export function DashboardNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {links.map((link) => {
        const active =
          link.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <link.icon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">{link.label}</span>
            {link.href === "/dashboard/notifications" && unread > 0 ? (
              <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-fg">
                {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
