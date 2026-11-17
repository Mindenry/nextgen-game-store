"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { toast } from "sonner";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy");
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted transition hover:text-fg"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function PaymentStatusWatcher({
  reference,
  initialStatus,
  expiresAt,
}: {
  reference: string;
  initialStatus: string;
  expiresAt: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status === "PAID" || status === "EXPIRED" || status === "REJECTED" || status === "FAILED") return;
    let cancelled = false;
    const poll = async () => {
      setChecking(true);
      try {
        const response = await fetch(`/api/payments/${encodeURIComponent(reference)}/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { status: string };
        if (cancelled) return;
        if (data.status !== status) {
          setStatus(data.status);
          if (data.status === "PAID") router.refresh();
          if (data.status === "EXPIRED") router.refresh();
        }
      } catch {
        /* offline */
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [reference, router, status]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <StatusPill status={status} />
        {checking ? <Loader2 className="size-3.5 animate-spin text-muted" /> : null}
      </div>
      <p className="text-[11px] text-muted">
        {secondsLeft > 0 ? (
          <>
            Expires in{" "}
            <span className="tabular font-semibold text-fg">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          </>
        ) : (
          "Expired"
        )}
      </p>
    </div>
  );
}
