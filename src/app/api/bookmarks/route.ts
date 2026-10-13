import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bookmarks
 * Returns all role IDs bookmarked by the authenticated user.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ roleIds: [] });
    }

    const bookmarks = await prisma.roleBookmark.findMany({
      where: { userId },
      select: { roleId: true },
    });

    return NextResponse.json({ roleIds: bookmarks.map((b) => b.roleId) });
  } catch (err) {
    console.error("GET /api/bookmarks error:", err);
    return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
  }
}

/**
 * POST /api/bookmarks
 * Toggle bookmark state for a role.
 * Body: { roleId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { roleId } = body;

    if (!roleId || typeof roleId !== "string") {
      return NextResponse.json({ error: "roleId is required" }, { status: 400 });
    }

    const existing = await prisma.roleBookmark.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existing) {
      await prisma.roleBookmark.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ bookmarked: false, roleId });
    } else {
      await prisma.roleBookmark.create({
        data: {
          userId,
          roleId,
        },
      });
      return NextResponse.json({ bookmarked: true, roleId }, { status: 201 });
    }
  } catch (err) {
    console.error("POST /api/bookmarks error:", err);
    return NextResponse.json({ error: "Failed to toggle bookmark" }, { status: 500 });
  }
}
