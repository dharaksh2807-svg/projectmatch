import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─────────────────────────────────────────────
// Supported platform definitions
// ─────────────────────────────────────────────

/** Platforms managed by NextAuth OAuth (existing Account table) */
const OAUTH_PLATFORMS = ["github", "linkedin"] as const;

/** Platforms managed by handle input (UserConnection table) */
const HANDLE_PLATFORMS = [
  "leetcode",
  "codeforces",
  "kaggle",
  "stackoverflow",
  "medium",
  "hashnode",
  "devto",
  "hackerrank",
  "gitlab",
  "twitter",
] as const;

type HandlePlatform = (typeof HANDLE_PLATFORMS)[number];

/** Canonical profile URL templates per platform */
const PROFILE_URL_TEMPLATES: Record<HandlePlatform, (handle: string) => string> = {
  leetcode: (h) => `https://leetcode.com/u/${h}`,
  codeforces: (h) => `https://codeforces.com/profile/${h}`,
  kaggle: (h) => `https://www.kaggle.com/${h}`,
  stackoverflow: (h) => `https://stackoverflow.com/users/${h}`,
  medium: (h) => `https://medium.com/@${h}`,
  hashnode: (h) => `https://hashnode.com/@${h}`,
  devto: (h) => `https://dev.to/${h}`,
  hackerrank: (h) => `https://www.hackerrank.com/profile/${h}`,
  gitlab: (h) => `https://gitlab.com/${h}`,
  twitter: (h) => `https://x.com/${h}`,
};

const postConnectionSchema = z.object({
  platform: z.enum([...HANDLE_PLATFORMS] as [string, ...string[]], {
    errorMap: () => ({
      message: `platform must be one of: ${HANDLE_PLATFORMS.join(", ")}`,
    }),
  }),
  handle: z
    .string()
    .min(1, "handle cannot be empty")
    .max(100, "handle must be ≤ 100 characters")
    .trim()
    .regex(
      /^[a-zA-Z0-9._\-@]+$/,
      "handle contains disallowed characters"
    ),
});

const deleteConnectionSchema = z.object({
  platform: z.enum([...HANDLE_PLATFORMS] as [string, ...string[]], {
    errorMap: () => ({
      message: `platform must be one of: ${HANDLE_PLATFORMS.join(", ")}`,
    }),
  }),
});

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

interface ConnectionResponse {
  platform: string;
  handle: string;
  profileUrl: string | null;
  source: "oauth" | "handle";
  metadata: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  connected: boolean;
}

// ─────────────────────────────────────────────
// GET /api/connections
// Merges OAuth connections (NextAuth Account) with
// handle-based connections (UserConnection).
// Returns the unified list of ALL platforms with
// their connection status.
// ─────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 1. Fetch OAuth accounts from the NextAuth Account table
    const oauthAccounts = await prisma.account.findMany({
      where: {
        userId,
        provider: { in: [...OAUTH_PLATFORMS] },
      },
      select: {
        provider: true,
        providerAccountId: true,
      },
    });

    // 2. Fetch handle-based connections from our UserConnection table
    const handleConnections = await prisma.userConnection.findMany({
      where: { userId },
    });

    // 3. Build the unified response — every platform included
    const results: ConnectionResponse[] = [];

    // OAuth platforms
    for (const platform of OAUTH_PLATFORMS) {
      const account = oauthAccounts.find((a) => a.provider === platform);
      results.push({
        platform,
        handle: account?.providerAccountId ?? "",
        profileUrl: account
          ? platform === "github"
            ? `https://github.com/${account.providerAccountId}`
            : `https://linkedin.com/in/${account.providerAccountId}`
          : null,
        source: "oauth",
        metadata: null,
        lastSyncedAt: null,
        connected: !!account,
      });
    }

    // Handle-based platforms
    for (const platform of HANDLE_PLATFORMS) {
      const conn = handleConnections.find((c) => c.platform === platform);
      results.push({
        platform,
        handle: conn?.handle ?? "",
        profileUrl: conn?.profileUrl ?? null,
        source: "handle",
        metadata: (conn?.metadata as Record<string, unknown>) ?? null,
        lastSyncedAt: conn?.lastSyncedAt?.toISOString() ?? null,
        connected: !!conn,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to fetch connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/connections
// Upserts a handle-based connection.
// Body: { platform: string, handle: string }
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = postConnectionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { platform, handle } = parseResult.data;

  // platform is already validated by z.enum — no manual checks needed
  const cleanHandle = handle.trim();
  const profileUrl =
    PROFILE_URL_TEMPLATES[platform as HandlePlatform](cleanHandle);

  try {
    const connection = await prisma.userConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
      update: {
        handle: cleanHandle,
        profileUrl,
      },
      create: {
        userId,
        platform,
        handle: cleanHandle,
        profileUrl,
      },
    });

    return NextResponse.json(connection, { status: 201 });
  } catch (error) {
    console.error("Failed to save connection:", error);
    return NextResponse.json(
      { error: "Failed to save connection" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/connections
// Removes a handle-based connection.
// Body: { platform: string }
// ─────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = deleteConnectionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { platform } = parseResult.data;

  // platform is already validated by z.enum — no manual checks needed

  try {
    await prisma.userConnection.delete({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Connection not found or already disconnected" },
      { status: 404 }
    );
  }
}
