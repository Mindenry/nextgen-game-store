import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ className, compact = false, href = "/" }: { className?: string; compact?: boolean; href?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)} aria-label="NEXTGEN GAME STORE home">
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-fg text-bg shadow-sm transition group-hover:scale-[1.03]">
        <span className="grid grid-cols-2 gap-[2px]">
          <span className="size-[7px] rounded-[2px] bg-primary" />
          <span className="size-[7px] rounded-[2px] bg-current opacity-80" />
          <span className="size-[7px] rounded-[2px] bg-current opacity-40" />
          <span className="size-[7px] rounded-[2px] bg-accent" />
        </span>
        <span className="absolute inset-x-0 top-0 h-px bg-white/40" />
      </span>
      {!compact ? (
        <span className="leading-none">
          <span className="font-display block text-[15px] font-bold tracking-[0.02em] text-fg">
            NEXTGEN
          </span>
          <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.26em] text-muted">
            Game Store
          </span>
        </span>
      ) : null}
    </Link>
  );
}
