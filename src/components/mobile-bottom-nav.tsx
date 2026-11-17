"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Home, ShoppingBag, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/products", label: "Shop", icon: ShoppingBag },
  { href: "/topup", label: "Top-up", icon: Gamepad2 },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard", label: "Account", icon: UserRound },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <item.icon className={cn("size-5", active && "stroke-[2.4]")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
