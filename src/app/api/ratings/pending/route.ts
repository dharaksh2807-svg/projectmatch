import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/ratings/pending
 * Returns all teammates the current user has NOT yet rated
 * across all COMPLETED projects they were part of.
 *
 * Response shape:
 * {
 *   pendingRatings: Array<{
 *     projectId: string;
 *     projectTitle: string;
 *     teamId: string;
 *     peers: Array<{ id, name, image, experienceLevel }>
 *   }>
 * }
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = currentUser.id;

  // Find all completed projects where the user is a team member OR the owner
  const completedTeams = await prisma.team.findMany({
    where: {
      project: { status: "COMPLETED" },
      OR: [
        { members: { some: { id: userId } } },
        { project: { ownerId: userId } },
      ],
    },
    include: {
      project: { select: { id: true, title: true, ownerId: true } },
      members: {
        select: { id: true, name: true, image: true, experienceLevel: true },
      },
    },
  });

  if (completedTeams.length === 0) {
    return NextResponse.json({ pendingRatings: [] });
  }

  // For each team, find which members the current user has already rated on that project
  const pendingRatings = [];

  for (const team of completedTeams) {
    // All ratings this user has given on this project
    const alreadyRated = await prisma.rating.findMany({
      where: { raterId: userId, projectId: team.project.id },
      select: { rateeId: true },
    });
    const ratedIds = new Set(alreadyRated.map((r) => r.rateeId));

    // Peers = all team members (and the owner if not already a member) excluding self and already-rated
    const peerSet = new Map<string, { id: string; name: string | null; image: string | null; experienceLevel: string | null }>();

    for (const member of team.members) {
      if (member.id !== userId && !ratedIds.has(member.id)) {
        peerSet.set(member.id, member);
      }
    }

    // Also include project owner if they aren't a listed member
    if (team.project.ownerId !== userId && !ratedIds.has(team.project.ownerId)) {
      const ownerAlreadyListed = peerSet.has(team.project.ownerId);
      if (!ownerAlreadyListed) {
        const owner = await prisma.user.findUnique({
          where: { id: team.project.ownerId },
          select: { id: true, name: true, image: true, experienceLevel: true },
        });
        if (owner) peerSet.set(owner.id, owner);
      }
    }

    const peers = Array.from(peerSet.values());

    if (peers.length > 0) {
      pendingRatings.push({
        projectId: team.project.id,
        projectTitle: team.project.title,
        teamId: team.id,
        peers,
      });
    }
  }

  return NextResponse.json({ pendingRatings });
}
