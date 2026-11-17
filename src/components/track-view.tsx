"use client";

import { useEffect } from "react";

export function TrackView({ productId }: { productId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ productId });
    const timer = window.setTimeout(() => {
      void fetch("/api/recently-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [productId]);
  return null;
}
