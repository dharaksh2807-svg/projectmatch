import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateSavedSearchSchema } from "@/lib/filters/saved-searches";

const MAX_SAVED_SEARCHES_PER_USER = 25;

/**
 * GET /api/saved-searches
 * Retrieves the authenticated user's saved searches, optionally filtered by discovery context.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const context = searchParams.get("context");

    const whereClause: { userId: string; context?: string } = { userId };
    if (context && (context === "ROLES" || context === "HACKATHONS")) {
      whereClause.context = context;
    }

    const savedSearches = await prisma.savedSearch.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ savedSearches });
  } catch (err) {
    console.error("GET /api/saved-searches error:", err);
    return NextResponse.json(
      { error: "Failed to fetch saved searches" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved-searches
 * Persists a new saved search for the authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required to save searches" },
        { status: 401 }
      );
    }

    // 1. Enforce per-user quota limit
    const currentCount = await prisma.savedSearch.count({
      where: { userId },
    });

    if (currentCount >= MAX_SAVED_SEARCHES_PER_USER) {
      return NextResponse.json(
        {
          error: `Storage limit reached: You can store up to ${MAX_SAVED_SEARCHES_PER_USER} saved searches. Please remove an older search first.`,
        },
        { status: 400 }
      );
    }

    // 2. Validate request payload with Zod
    const body = await req.json();
    const parseResult = CreateSavedSearchSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { name, context, filters } = parseResult.data;

    // 3. Prevent duplicate search names for the same user and context
    const existing = await prisma.savedSearch.findFirst({
      where: {
        userId,
        context,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `A saved search named "${name}" already exists in this context. Please choose a different name or update the existing one.`,
        },
        { status: 409 }
      );
    }

    // 4. Persist saved search
    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId,
        name,
        context,
        version: 1,
        filters,
      },
    });

    return NextResponse.json(
      {
        savedSearch,
        message: `Search "${savedSearch.name}" saved successfully!`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/saved-searches error:", err);
    return NextResponse.json(
      { error: "Failed to save search configuration" },
      { status: 500 }
    );
  }
}
