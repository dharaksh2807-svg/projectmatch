import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ratingSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  rateeId: z.string().min(1, "rateeId is required"),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/**
 * POST /api/ratings
 * Submit a star rating for a teammate on a completed project.
 *
 * Rules:
 *  - Requester must be a team member or owner of the project.
 *  - Project must be COMPLETED.
 *  - Cannot rate yourself.
 *  - Ratee must also be on the same team.
 *  - One rating per (projectId, raterId, rateeId) — 409 on duplicate.
 *
 * On success:
 *  - Creates Rating record.
 *  - Recomputes ratee's normalizedScore = (sum / count / 5) * 100.
 *  - Updates User.reputationScore.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse & validate body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ratingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { projectId, rateeId, score, comment } = parsed.data;

  // Get current user
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const raterId = currentUser.id;

  // Self-rating guard
  if (raterId === rateeId) {
    return NextResponse.json({ error: "You cannot rate yourself." }, { status: 400 });
  }

  // Fetch project with team
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      team: {
        include: { members: { select: { id: true } } },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // Status guard
  if (project.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Ratings are only allowed after a project is marked as completed." },
      { status: 409 }
    );
  }

  // Team membership guard
  const memberIds = project.team?.members.map((m) => m.id) ?? [];
  const isOwner = project.ownerId === raterId;
  const isMember = memberIds.includes(raterId);

  if (!isOwner && !isMember) {
    return NextResponse.json(
      { error: "You are not a member of this project." },
      { status: 403 }
    );
  }

  // Ratee must be on the team (or be the owner)
  const rateeIsMember = memberIds.includes(rateeId) || project.ownerId === rateeId;
  if (!rateeIsMember) {
    return NextResponse.json(
      { error: "The person you are rating is not a member of this project." },
      { status: 404 }
    );
  }

  if (!project.team) {
    return NextResponse.json(
      { error: "No team found for this project." },
      { status: 404 }
    );
  }

  const teamId = project.team.id;

  try {
    // Transactional: create rating + recompute reputationScore
    const { rating, newReputationScore } = await prisma.$transaction(async (tx) => {
      // Create rating
      const rating = await tx.rating.create({
        data: {
          teamId,
          projectId,
          raterId,
          rateeId,
          score,
          comment: comment || null,
        },
      });

      // Fetch ALL ratings received by ratee (across all projects)
      const allReceived = await tx.rating.findMany({
        where: { rateeId },
        select: { score: true },
      });

      // Compute normalized reputation: (sum / count / 5) * 100 → 0–100
      const totalScore = allReceived.reduce((acc, r) => acc + r.score, 0);
      const newReputationScore =
        Math.round((totalScore / (allReceived.length * 5)) * 1000) / 10; // 1 decimal

      // Update ratee's reputation
      await tx.user.update({
        where: { id: rateeId },
        data: { reputationScore: newReputationScore },
      });

      return { rating, newReputationScore };
    });

    return NextResponse.json(
      { rating, newReputationScore },
      { status: 201 }
    );
  } catch (err: unknown) {
    // Unique constraint violation → duplicate rating
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "You have already rated this teammate for this project." },
        { status: 409 }
      );
    }
    console.error("[POST /api/ratings] Error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
