import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p> : null}
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
