import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPlatformData, IntegrationError } from "@/lib/integrations";

/**
 * POST /api/connections/sync
 * Syncs metadata for one specific platform, or all connected platforms.
 *
 * Body: { platform?: string }
 *   - If `platform` is provided, syncs only that platform.
 *   - If omitted, syncs all connected platforms (best effort — errors per-platform).
 */
export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: { platform?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — default to syncing all platforms
  }

  const { platform } = body;

  try {
    // Fetch the connections to sync
    const connections = await prisma.userConnection.findMany({
      where: {
        userId,
        ...(platform ? { platform: platform.toLowerCase().trim() } : {}),
      },
    });

    if (connections.length === 0) {
      return NextResponse.json(
        { error: platform ? `No connection found for "${platform}"` : "No connections to sync" },
        { status: 404 }
      );
    }

    // Sync each connection — errors are collected per-platform, not fatal globally
    const results: {
      platform: string;
      success: boolean;
      error?: string;
    }[] = [];

    await Promise.allSettled(
      connections.map(async (conn) => {
        try {
          const metadata = await syncPlatformData(conn.platform, conn.handle);

          await prisma.userConnection.update({
            where: { id: conn.id },
            data: {
              metadata: metadata as object,
              lastSyncedAt: new Date(),
            },
          });

          results.push({ platform: conn.platform, success: true });
        } catch (error) {
          const message =
            error instanceof IntegrationError
              ? error.message
              : "Unknown sync error";
          results.push({ platform: conn.platform, success: false, error: message });
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      synced: successCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Failed to sync connections" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("POST /api/connections/sync unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
