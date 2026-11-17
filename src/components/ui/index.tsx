import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-55 active:scale-[0.985] whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-[0_10px_30px_-14px_var(--primary)] hover:bg-primary-hover",
        secondary: "bg-surface-2 text-fg border border-border hover:border-border-strong hover:bg-bg-soft",
        outline: "border border-border-strong bg-transparent text-fg hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        danger: "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15",
        success: "bg-success/12 text-success border border-success/25 hover:bg-success/18",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-lg",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function buttonClass(
  props: VariantProps<typeof buttonVariants> & { className?: string } = {},
) {
  return cn(buttonVariants({ variant: props.variant, size: props.size }), props.className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-4 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-fg", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-semibold tracking-wide text-fg-soft", className)} {...props} />;
}

const fieldBase =
  "focus-ring w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted/70 transition disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "min-h-24 resize-y", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, "h-10 pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  required,
  className,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label} {required ? <span className="text-danger">*</span> : null}
        </Label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "accent" | "outline";
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-border",
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/25",
    danger: "bg-danger/10 text-danger border-danger/20",
    accent: "bg-accent/10 text-accent border-accent/20",
    outline: "bg-transparent text-fg-soft border-border-strong",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const STATUS_TONES: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "accent"> = {
  paid: "success",
  completed: "success",
  delivered: "success",
  approved: "success",
  active: "success",
  COMPLETED: "success",
  PAID: "success",
  pending: "warning",
  pending_payment: "warning",
  processing: "primary",
  PROCESSING: "primary",
  PENDING: "warning",
  VERIFYING: "primary",
  MANUAL_REVIEW: "warning",
  unpaid: "neutral",
  open: "primary",
  resolved: "success",
  refunded: "accent",
  REFUNDED: "accent",
  failed: "danger",
  REJECTED: "danger",
  FAILED: "danger",
  EXPIRED: "neutral",
  cancelled: "neutral",
  closed: "neutral",
  suspended: "danger",
  rejected: "danger",
  SOLD: "neutral",
  AVAILABLE: "success",
  RESERVED: "warning",
  DISABLED: "neutral",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const label = status.replaceAll("_", " ");
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} className={cn("capitalize", className)}>
      {label.toLowerCase()}
    </Badge>
  );
}

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-primary/25 bg-primary/8 text-primary",
    success: "border-success/25 bg-success/8 text-success",
    warning: "border-warning/30 bg-warning/8 text-warning",
    danger: "border-danger/25 bg-danger/8 text-danger",
  };
  const Icon = variant === "success" ? CheckCircle2 : variant === "danger" || variant === "warning" ? AlertCircle : Info;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", styles[variant], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-fg-soft", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div> : null}
      <p className="font-semibold text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl font-semibold text-fg md:text-[28px]">{title}</h2>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass = {
    default: "bg-surface-2 text-fg-soft",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  }[tone];
  return (
    <div className={cn("surface-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {icon ? <div className={cn("grid size-9 place-items-center rounded-xl", toneClass)}>{icon}</div> : null}
      </div>
      <p className="tabular mt-3 text-2xl font-semibold text-fg">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table className={cn("w-full min-w-[640px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border/70 px-3 py-3 align-middle text-fg-soft", className)} {...props} />;
}

export function Pagination({
  page,
  pages,
  makeHref,
}: {
  page: number;
  pages: number;
  makeHref: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => {
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    return start + i;
  }).filter((n) => n >= 1 && n <= pages);
  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {page > 1 ? (
        <a href={makeHref(page - 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Prev
        </a>
      ) : null}
      {numbers.map((n) => (
        <a
          key={n}
          href={makeHref(n)}
          aria-current={n === page ? "page" : undefined}
          className={cn(
            "grid size-8 place-items-center rounded-lg border text-xs font-semibold transition",
            n === page
              ? "border-primary bg-primary text-primary-fg"
              : "border-border bg-surface text-muted hover:text-fg",
          )}
        >
          {n}
        </a>
      ))}
      {page < pages ? (
        <a href={makeHref(page + 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Next
        </a>
      ) : null}
    </nav>
  );
}
