import { NextResponse } from "next/server";
import { getDiscoverableTechCatalog } from "@/lib/filters/tech-catalog-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/technologies
 * Returns all dynamically extracted technologies across discoverable projects,
 * popularity counts, top popular technologies, and taxonomy categories.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const refresh = url.searchParams.get("refresh") === "true";

    const catalog = await getDiscoverableTechCatalog(undefined, refresh);

    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("GET /api/technologies error:", err);
    return NextResponse.json(
      { error: "Failed to load technology catalog" },
      { status: 500 }
    );
  }
}
