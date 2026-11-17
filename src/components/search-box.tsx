"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";

type Suggestions = {
  products: { slug: string; name: string; image_url: string | null; price: string }[];
  categories: { slug: string; name: string }[];
};

export function SearchBox({
  className,
  placeholder = "Search games, accounts or gift cards…",
  defaultValue = "",
  autoFocus,
}: {
  className?: string;
  placeholder?: string;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [data, setData] = useState<Suggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (query.trim().length < 2) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.ok) setData((await response.json()) as Suggestions);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setOpen(false);
    router.push(`/products?q=${encodeURIComponent(value)}`);
  }

  const hasResults = Boolean(data && (data.products.length > 0 || data.categories.length > 0));

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form onSubmit={submit} role="search">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-2/70 px-3 transition focus-within:border-primary/40 focus-within:bg-surface">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label="Search products"
            autoFocus={autoFocus}
            className="h-full w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted/80"
          />
          {loading ? <Loader2 className="size-4 animate-spin text-muted" /> : null}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setData(null);
              }}
              aria-label="Clear search"
              className="text-muted hover:text-fg"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </form>

      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-lg)]">
          {!hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {loading ? "Searching…" : "No matches. Try another keyword."}
            </p>
          ) : (
            <div className="space-y-1">
              {data!.categories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                  {data!.categories.map((category) => (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/categories/${category.slug}`);
                      }}
                      className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-fg-soft hover:border-primary/40 hover:text-primary"
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {data!.products.map((product) => (
                <button
                  key={product.slug}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/products/${product.slug}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2"
                >
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
                    {product.image_url ? (
                       
                      <img src={product.image_url} alt="" className="size-full object-cover" />
                    ) : (
                      <Search className="size-4 text-muted" />
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{product.name}</span>
                  <span className="tabular text-xs font-semibold text-muted">{formatTHB(product.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
