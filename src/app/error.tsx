"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="surface-card max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          The page could not be loaded. No payment or order was changed. Try again, or contact support with the time it
          happened.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg"
          >
            <RefreshCw className="size-4" /> Try again
          </button>
          <Link
            href="/"
            className="focus-ring inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold"
          >
            Back to store
          </Link>
        </div>
      </div>
    </div>
  );
}
