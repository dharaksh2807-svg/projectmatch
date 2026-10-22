import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewResponseSchema } from "@/lib/validations";
import { canRespondToReview } from "@/lib/reputation/service";

type Params = Promise<{ id: string }>;

/**
 * POST /api/reviews/[id]/response
 * Allows the reviewee to post an official factual response to a review.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await params;

    const existingReview = await prisma.review.findUnique({
      where: { id },
      select: { id: true, revieweeId: true, responseContent: true },
    });

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const check = canRespondToReview(existingReview, userId);
    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = reviewResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        responseContent: parsed.data.responseContent.trim(),
        respondedAt: new Date(),
      },
      include: {
        reviewer: { select: { id: true, name: true, image: true } },
        project: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      success: true,
      review: updatedReview,
    });
  } catch (error) {
    console.error("POST /api/reviews/[id]/response failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
