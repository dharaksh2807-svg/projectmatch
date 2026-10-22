import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPermittedUserSchedule } from "@/lib/scheduling/service";

type Params = Promise<{ userId: string }>;

/**
 * GET /api/availability/user/[userId]
 * Fetches a user's availability schedule subject to server-side privacy controls.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);

  try {
    const result = await getPermittedUserSchedule(userId, session?.user?.id);

    if (result.status === "PRIVATE") {
      return NextResponse.json(
        {
          schedule: null,
          status: "PRIVATE",
          message: "This schedule is private or restricted to shared team members.",
        },
        { status: 403 }
      );
    }

    if (result.status === "MISSING") {
      return NextResponse.json(
        {
          schedule: null,
          status: "MISSING",
          message: "User has not configured an availability schedule.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`GET /api/availability/user/${userId} error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch user availability" },
      { status: 500 }
    );
  }
}
