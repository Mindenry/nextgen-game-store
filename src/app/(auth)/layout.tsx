import Link from "next/link";
import { ArrowLeft, BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-fg p-10 text-bg lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_85%,color-mix(in_srgb,var(--primary)_60%,transparent),transparent_55%)] opacity-70" />
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-[11px] bg-bg text-fg">
              <span className="grid grid-cols-2 gap-[2px]">
                <span className="size-[7px] rounded-[2px] bg-primary" />
                <span className="size-[7px] rounded-[2px] bg-current opacity-80" />
                <span className="size-[7px] rounded-[2px] bg-current opacity-40" />
                <span className="size-[7px] rounded-[2px] bg-accent" />
              </span>
            </span>
            <span className="leading-none">
              <span className="font-display block text-[15px] font-bold tracking-wide">NEXTGEN</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.26em] opacity-60">Game Store</span>
            </span>
          </Link>
        </div>

        <div className="relative my-auto max-w-lg py-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] opacity-60">Player accounts</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            One account.
            <br />
            Your entire game library.
          </h2>
          <p className="mt-4 text-sm leading-relaxed opacity-70">
            Keep every purchase, top-up and wallet transaction in one secure place — with an auditable ledger behind
            every balance.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Encrypted inventory and private delivery vault",
              "Wallet balance protected by a double-entry ledger",
              "PromptPay and manual slip verification",
              "Order history, invoices and instant downloads",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 opacity-85">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-5 text-[11px] opacity-60">
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Server-verified</span>
          <span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Encrypted at rest</span>
        </div>
      </aside>

      <main className="relative flex flex-col bg-bg">
        <div className="flex items-center justify-between p-5 lg:justify-end">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg lg:hidden">
            <ArrowLeft className="size-3.5" /> Back to store
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <div className="p-5 text-center text-[10px] text-muted">
          Using this site means you accept our{" "}
          <Link href="/legal/terms" className="underline hover:text-fg">terms</Link> and{" "}
          <Link href="/legal/privacy" className="underline hover:text-fg">privacy policy</Link>.
        </div>
      </main>
    </div>
  );
}
