import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface EligibleTeammate {
  id: string;
  name: string | null;
  image: string | null;
  experienceLevel: string | null;
  skills: string[];
}

export interface EligibleProjectReviews {
  projectId: string;
  projectTitle: string;
  status: string;
  peers: EligibleTeammate[];
}

/**
 * GET /api/reviews/eligible
 * Returns completed projects where the current user collaborated and has unreviewed teammates.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all completed projects where current user is owner or accepted applicant
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { applications: { some: { userId, status: "ACCEPTED" } } },
        ],
        AND: [
          {
            OR: [{ status: "COMPLETED" }, { completedAt: { not: null } }],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        owner: {
          select: { id: true, name: true, image: true, experienceLevel: true, skills: true },
        },
        applications: {
          where: { status: "ACCEPTED" },
          select: {
            user: {
              select: { id: true, name: true, image: true, experienceLevel: true, skills: true },
            },
          },
        },
        reviews: {
          where: { reviewerId: userId },
          select: { revieweeId: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const pendingRatings: EligibleProjectReviews[] = [];

    for (const p of projects) {
      const reviewedIds = new Set(p.reviews.map((r) => r.revieweeId));
      const teammateMap = new Map<string, EligibleTeammate>();

      // Add owner if current user is not owner
      if (p.ownerId !== userId) {
        teammateMap.set(p.owner.id, p.owner);
      }

      // Add accepted teammates except current user
      for (const app of p.applications) {
        if (app.user.id !== userId) {
          teammateMap.set(app.user.id, app.user);
        }
      }

      // Filter out teammates already reviewed
      const unreviewedPeers = Array.from(teammateMap.values()).filter(
        (peer) => !reviewedIds.has(peer.id)
      );

      if (unreviewedPeers.length > 0) {
        pendingRatings.push({
          projectId: p.id,
          projectTitle: p.title,
          status: p.status,
          peers: unreviewedPeers,
        });
      }
    }

    return NextResponse.json({ pendingRatings });
  } catch (error) {
    console.error("GET /api/reviews/eligible failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
