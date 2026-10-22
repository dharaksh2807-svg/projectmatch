import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeTeamInvitation } from "@/lib/invitations";

type Params = Promise<{ id: string; invitationId: string }>;

/**
 * DELETE /api/projects/[id]/invitations/[invitationId]
 * Revokes an invitation link.
 * Authorized to project owner only.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, invitationId } = await params;

    try {
      const result = await revokeTeamInvitation(projectId, invitationId, session.user.id);
      return NextResponse.json(result);
    } catch (err: any) {
      if (err.message === "PROJECT_NOT_FOUND" || err.message === "INVITATION_NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (err.message === "UNAUTHORIZED_NOT_OWNER") {
        return NextResponse.json(
          { error: "Forbidden: Only the project owner can revoke invitations" },
          { status: 403 }
        );
      }
      console.error("DELETE /api/projects/[id]/invitations/[invitationId] failed:", err);
      return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
    }
  } catch (outerErr) {
    console.error("DELETE /api/projects/[id]/invitations/[invitationId] outer error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/invitations/[invitationId]
 * Support for PATCH as an alternative to DELETE for revoking.
 */
export async function PATCH(req: NextRequest, context: { params: Params }) {
  return DELETE(req, context);
}
