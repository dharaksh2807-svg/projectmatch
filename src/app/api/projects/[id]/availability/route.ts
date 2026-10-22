import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTeamAvailability } from "@/lib/scheduling/service";
import { isValidIanaTimezone } from "@/lib/scheduling/timezone";

type Params = Promise<{ id: string }>;

/**
 * GET /api/projects/[id]/availability
 * Evaluates mutual schedule overlap and suggested coding windows for an authorized team.
 * Only project owner and accepted team members can access this endpoint.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") || undefined;
  const daysParam = searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : undefined;
  const tzParam = searchParams.get("timezone");
  const viewerTimezone = tzParam && isValidIanaTimezone(tzParam) ? tzParam : undefined;
  const minMinutesParam = searchParams.get("minWindowMinutes");
  const minWindowMinutes = minMinutesParam ? parseInt(minMinutesParam, 10) : undefined;

  try {
    const result = await getTeamAvailability(projectId, session.user.id, {
      startDate,
      days: days && days > 0 && days <= 30 ? days : 7,
      viewerTimezone,
      minWindowMinutes,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (err?.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (err?.message?.startsWith("FORBIDDEN")) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only authorized team members can view shared team availability." },
        { status: 403 }
      );
    }
    console.error(`GET /api/projects/${projectId}/availability error:`, err);
    return NextResponse.json(
      { error: "Failed to evaluate team availability" },
      { status: 500 }
    );
  }
}
