"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Package, Shield, UserRound, Wallet } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { initials } from "@/lib/utils";

export function UserMenu({
  displayName,
  email,
  roleId,
  avatarUrl,
}: {
  displayName: string;
  email: string;
  roleId: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const staff = roleId !== "customer";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Account menu"
        className="focus-ring flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5 transition hover:border-border-strong"
      >
        <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-primary/12 text-[11px] font-bold text-primary">
          {avatarUrl ? (
             
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(displayName || email)
          )}
        </span>
        <ChevronDown className="size-3.5 text-muted" />
      </button>

      {open ? (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-lg)]">
            <div className="border-b border-border px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-fg">{displayName}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <div className="py-1">
              {[
                { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
                { href: "/dashboard/orders", label: "My orders", icon: Package },
                { href: "/dashboard/wallet", label: "My wallet", icon: Wallet },
                { href: "/dashboard/profile", label: "Profile", icon: UserRound },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-soft transition hover:bg-surface-2 hover:text-fg"
                >
                  <item.icon className="size-4 text-muted" />
                  {item.label}
                </Link>
              ))}
              {staff ? (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/8"
                >
                  <Shield className="size-4" />
                  Admin dashboard
                </Link>
              ) : null}
            </div>
            <form action={logoutAction} className="border-t border-border pt-1">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-danger/8 hover:text-danger"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
