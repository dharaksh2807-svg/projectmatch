import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateSavedSearchSchema } from "@/lib/filters/saved-searches";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/saved-searches/[id]
 * Retrieves a single saved search with ownership verification.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const savedSearch = await prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    if (!savedSearch) {
      return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
    }

    return NextResponse.json({ savedSearch });
  } catch (err) {
    console.error("GET /api/saved-searches/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch saved search" }, { status: 500 });
  }
}

/**
 * PUT /api/saved-searches/[id]
 * Updates a saved search (rename or update filters) with ownership verification.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Saved search not found or unauthorized" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parseResult = UpdateSavedSearchSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { name, filters } = parseResult.data;

    // Check duplicate name if name is changing
    if (name && name !== existing.name) {
      const duplicate = await prisma.savedSearch.findFirst({
        where: {
          userId,
          context: existing.context,
          name: {
            equals: name,
            mode: "insensitive",
          },
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            error: `A saved search named "${name}" already exists in this context.`,
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.savedSearch.update({
      where: { id: existing.id },
      data: {
        ...(name ? { name } : {}),
        ...(filters ? { filters } : {}),
      },
    });

    return NextResponse.json({
      savedSearch: updated,
      message: `Saved search "${updated.name}" updated successfully.`,
    });
  } catch (err) {
    console.error("PUT /api/saved-searches/[id] error:", err);
    return NextResponse.json({ error: "Failed to update saved search" }, { status: 500 });
  }
}

/**
 * DELETE /api/saved-searches/[id]
 * Deletes a saved search with ownership verification.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Saved search not found or unauthorized" },
        { status: 404 }
      );
    }

    await prisma.savedSearch.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({
      success: true,
      message: `Saved search "${existing.name}" removed successfully.`,
    });
  } catch (err) {
    console.error("DELETE /api/saved-searches/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete saved search" }, { status: 500 });
  }
}
