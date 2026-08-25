import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const result: Record<string, unknown> = {};

  try {
    // Step 1: Exact same session call as dashboard page.tsx line 49
    const session = await getServerSession(authOptions);
    result.step1_session = session ? { email: session.user?.email } : "NO_SESSION";

    if (!session?.user?.email) {
      return NextResponse.json({ ...result, stopped: "no session email" });
    }

    // Step 2: Exact same prisma query as dashboard page.tsx lines 54-68
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        projectsOwned: {
          include: { roles: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        applications: {
          include: { role: { include: { project: true } } },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });
    result.step2_user = user ? {
      id: user.id,
      name: user.name,
      skillsCount: user.skills?.length,
      projectsOwnedCount: user.projectsOwned?.length,
      applicationsCount: user.applications?.length,
      reputationScore: user.reputationScore,
      reputationScoreType: typeof user.reputationScore,
    } : "USER_NOT_FOUND";

    // Step 3: Same computations as dashboard page.tsx lines 70-85
    if (user) {
      const hasProfile = user.skills.length > 0 && user.experienceLevel;
      result.step3_hasProfile = hasProfile;

      const profileCompletion = Math.round(
        ([
          user.name,
          user.skills.length > 0,
          user.interests.length > 0,
          user.availabilityHours,
          user.experienceLevel,
          user.portfolioLinks.length > 0,
        ].filter(Boolean).length / 6) * 100
      );
      result.step3_profileCompletion = profileCompletion;

      // Test the toFixed call that might crash
      try {
        const val = user.reputationScore.toFixed(1);
        result.step3_toFixed = val;
      } catch (e: unknown) {
        result.step3_toFixedError = e instanceof Error ? e.message : String(e);
      }
    }

    result.allStepsPassed = true;
  } catch (e: unknown) {
    result.error = e instanceof Error ? { message: e.message, stack: e.stack?.split("\n").slice(0, 8) } : String(e);
  }

  return NextResponse.json(result);
}
