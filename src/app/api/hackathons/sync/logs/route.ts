import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/hackathons/sync/logs
 * Retrieve recent synchronization run logs for health and failure monitoring.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const sourceId = searchParams.get("sourceId");

    const where: { sourceId?: string } = {};
    if (sourceId) {
      where.sourceId = sourceId;
    }

    const logs = await prisma.hackathonSyncLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      count: logs.length,
      logs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("GET /api/hackathons/sync/logs failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch sync logs", details: message },
      { status: 500 }
    );
  }
}
