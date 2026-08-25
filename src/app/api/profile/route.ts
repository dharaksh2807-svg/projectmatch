import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validations";

export const runtime = "nodejs";

// GET /api/profile — get current user's profile
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/profile — create or update profile
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = profileSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.flatten() },
      { status: 422 }
    );
  }

  const data = result.data;

  const user = await prisma.user.update({
    where: { email: session.user.email },
    data: {
      name: data.name,
      skills: data.skills,
      interests: data.interests,
      availabilityHours: data.availabilityHours,
      availabilityDuration: data.availabilityDuration,
      timezone: data.timezone,
      experienceLevel: data.experienceLevel,
      portfolioLinks: data.portfolioLinks,
    },
  });

  return NextResponse.json(user);
}
