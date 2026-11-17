"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";

type Result = { error?: string; success?: string };

export function AdminActionButton({
  action,
  label,
  confirmText,
  variant = "outline",
  size = "sm",
  icon,
}: {
  action: () => Promise<Result>;
  label: string;
  confirmText?: string;
  variant?: "primary" | "secondary" | "danger" | "success" | "outline" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function run() {
    setOpen(false);
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Done");
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => (confirmText ? setOpen(true) : run())}
        className="whitespace-nowrap"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : icon}
        {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-sm font-semibold">Confirm action</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">{confirmText}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant={variant === "danger" ? "danger" : "primary"} size="sm" onClick={run}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
