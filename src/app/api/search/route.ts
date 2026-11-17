import { NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 80) ?? "";
  if (query.trim().length < 2) {
    return NextResponse.json({ products: [], categories: [] });
  }
  const results = await searchSuggestions(query);
  return NextResponse.json(results, {
    headers: { "Cache-Control": "private, max-age=5" },
  });
}
