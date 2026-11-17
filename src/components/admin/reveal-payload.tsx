"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";

type Result = { error?: string; success?: string; data?: unknown };

export function RevealPayload({ action, label = "Reveal" }: { action: () => Promise<Result>; label?: string }) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run() {
    if (payload) {
      setOpen((value) => !value);
      return;
    }
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPayload((result.data as Record<string, unknown>) ?? {});
      setOpen(true);
    });
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : open ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {pending ? "Decrypting…" : open ? "Hide" : label}
      </Button>
      {payload && open ? (
        <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-warning/25 bg-warning/5 p-2 font-mono text-[10px] text-fg">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
