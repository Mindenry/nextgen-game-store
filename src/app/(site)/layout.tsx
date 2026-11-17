import { getCurrentUser } from "@/lib/auth";
import { isMaintenanceMode } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, maintenance] = await Promise.all([getCurrentUser(), isMaintenanceMode()]);

  if (maintenance && (!user || user.roleId === "customer")) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg px-6">
        <div className="surface-card max-w-lg p-10 text-center">
          <Brand className="mx-auto justify-center" />
          <h1 className="mt-8 text-2xl font-semibold">We&apos;ll be right back</h1>
          <p className="mt-2 text-sm text-muted">
            The store is temporarily in maintenance mode. Existing orders and wallet balances remain safe.
          </p>
          <Link href="/login" className={buttonClass({ variant: "outline", className: "mt-6" })}>
            Staff sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
