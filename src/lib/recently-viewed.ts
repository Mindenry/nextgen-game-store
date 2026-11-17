import "server-only";
import { cookies } from "next/headers";
import { many } from "@/lib/db";
import type { ProductCard } from "@/lib/catalog";
import { CARD_COLUMNS } from "@/lib/catalog-sql";

export const RECENT_COOKIE = "ngs_recent";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getRecentlyViewed(excludeId?: string): Promise<ProductCard[]> {
  const store = await cookies();
  const raw = store.get(RECENT_COOKIE)?.value;
  if (!raw) return [];
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === "string" && UUID_RE.test(id));
  } catch {
    return [];
  }
  ids = ids.filter((id) => id !== excludeId).slice(0, 6);
  if (ids.length === 0) return [];
  return many<ProductCard>(
    `select ${CARD_COLUMNS} from products p join categories c on c.id = p.category_id
     where p.id = any($1::uuid[]) and p.is_active`,
    [ids],
  );
}
