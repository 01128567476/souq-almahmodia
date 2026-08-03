import { NextResponse } from "next/server";
import { searchGlobalMixed } from "@/services/repositories/searchRepository";

/**
 * GET /api/search
 * Query param: q (search query string)
 *
 * Server-only search endpoint. Delegates to the search repository
 * which accesses PostgreSQL via Drizzle ORM.
 *
 * Client Components MUST use this API route instead of importing
 * searchRepository directly (which would bundle pg into the client).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const results = await searchGlobalMixed(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[search-api] Error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}