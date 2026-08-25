import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rankRolesForUser } from "@/lib/matching";

export const runtime = "nodejs";

/**
 * GET /api/match/roles-for-user
 * Returns open roles ranked by compatibility for the authenticated user.
 * Optional query params: limit (default 20), minScore (default 0)
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const minScore = parseFloat(searchParams.get("minScore") || "0");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch all open roles with their project data
  const roles = await prisma.role.findMany({
    where: {
      filledCount: { lt: prisma.role.fields.headcount },
    },
    include: {
      project: {
        include: {
          owner: { select: { name: true, image: true } },
        },
      },
    },
  });

  const ranked = rankRolesForUser(
    {
      id: user.id,
      name: user.name,
      image: user.image,
      skills: user.skills,
      interests: user.interests,
      availabilityHours: user.availabilityHours,
      availabilityDuration: user.availabilityDuration,
      experienceLevel: user.experienceLevel,
      reputationScore: user.reputationScore,
      portfolioLinks: user.portfolioLinks,
    },
    roles,
    {
      excludeOwnedBy: user.id,
      minScore,
      limit,
    }
  );

  return NextResponse.json({
    userId: user.id,
    count: ranked.length,
    results: ranked,
  });
}
