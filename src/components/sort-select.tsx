"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <select
      aria-label="Sort products"
      value={value}
      onChange={(event) => {
        const next = new URLSearchParams(params.toString());
        next.set("sort", event.target.value);
        next.delete("page");
        router.push(`?${next.toString()}`);
      }}
      className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg-soft outline-none"
    >
      <option value="popular">Most popular</option>
      <option value="latest">Newest</option>
      <option value="best_selling">Best selling</option>
      <option value="price_asc">Price: low to high</option>
      <option value="price_desc">Price: high to low</option>
      <option value="rating">Top rated</option>
    </select>
  );
}
