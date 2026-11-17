"use client";

import Link from "next/link";
import { useState } from "react";
import { LogIn, Menu, UserPlus, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { SearchBox } from "@/components/search-box";
import { ThemeToggle } from "@/components/theme-provider";
import { buttonClass } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";

type Category = { slug: string; name: string; icon: string };

export function MobileMenu({
  categories,
  loggedIn,
}: {
  categories: Category[];
  loggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="focus-ring grid size-9 place-items-center rounded-xl border border-border bg-surface text-fg md:hidden"
      >
        <Menu className="size-4" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-bg p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-xl border border-border">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-5">
              <SearchBox />
            </div>
            <nav className="mt-5 space-y-1">
              {[
                { href: "/", label: "Home" },
                { href: "/products", label: "All products" },
                { href: "/topup", label: "Game top-up" },
                { href: "/dashboard", label: "My dashboard" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-fg-soft hover:bg-surface-2 hover:text-fg"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Categories</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-medium text-fg-soft"
                >
                  <CategoryIcon name={category.icon} className="size-3.5 text-primary" />
                  <span className="truncate">{category.name}</span>
                </Link>
              ))}
            </div>
            <div className="mt-auto space-y-2 pt-6">
              {loggedIn ? (
                <Link href="/dashboard" onClick={() => setOpen(false)} className={buttonClass({ className: "w-full" })}>
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className={buttonClass({ className: "w-full" })}>
                    <LogIn className="size-4" /> Sign in
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)} className={buttonClass({ variant: "secondary", className: "w-full" })}>
                    <UserPlus className="size-4" /> Create account
                  </Link>
                </>
              )}
              <div className="flex justify-end pt-2">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
