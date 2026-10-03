import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileUpdateSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  bio: z.string().max(600).trim().optional(),
  skills: z.array(z.string().max(50)).max(30).optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional().nullable(),
  availability: z.enum(["Full-time", "Part-time", "Flexible", "Weekends"]).optional().nullable(),
  timezone: z.string().max(60).optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().url().optional().nullable().or(z.literal("")),
  twitterHandle: z.string().max(50).trim().optional().nullable(),
});

/**
 * GET /api/profile
 * Returns the current user's full profile including skills, experience, and connections.
 */
export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        skills: true,
        experienceLevel: true,
        availability: true,
        timezone: true,
        reputationScore: true,
        portfolioUrl: true,
        linkedinUrl: true,
        twitterHandle: true,
        createdAt: true,
        connections: {
          select: {
            id: true,
            platform: true,
            handle: true,
            profileUrl: true,
            lastSyncedAt: true,
          },
        },
        _count: {
          select: {
            ownedProjects: true,
            applications: true,
            agents: true,
            chats: true,
          },
        },
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    console.error("GET /api/profile failed:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("GET /api/profile unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile
 * Updates the current user's profile.
 * All fields are optional — only provided fields are updated.
 */
export async function PATCH(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  // Normalize empty strings to null for URL fields
  const data = {
    ...parsed.data,
    portfolioUrl: parsed.data.portfolioUrl || null,
    linkedinUrl: parsed.data.linkedinUrl || null,
  };

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        skills: true,
        experienceLevel: true,
        availability: true,
        timezone: true,
        reputationScore: true,
        portfolioUrl: true,
        linkedinUrl: true,
        twitterHandle: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/profile failed:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("PATCH /api/profile unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
