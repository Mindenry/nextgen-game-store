"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/product-card";

export function ProductGallery({
  images,
  name,
  icon,
}: {
  images: { id: string; url: string; alt: string | null }[];
  name: string;
  icon: string;
}) {
  const [active, setActive] = useState(0);
  const image = images[active];

  return (
    <div className="space-y-3">
      <div className="surface-card relative aspect-square overflow-hidden p-0">
        {image ? (
           
          <img
            src={image.url}
            alt={image.alt ?? name}
            className="size-full object-cover"
          />
        ) : (
          <ProductImage imageUrl={null} name={name} icon={icon} className="size-full" iconClassName="size-24" />
        )}
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
            100% authentic
          </span>
        </div>
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-5 gap-2">
          {images.map((thumb, index) => (
            <button
              key={thumb.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`View image ${index + 1}`}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border transition",
                index === active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-border-strong",
              )}
            >
              { }
              <img src={thumb.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      {images.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <ImageOff className="size-3.5" /> Category artwork shown — product photos can be added in admin.
        </p>
      ) : null}
    </div>
  );
}
