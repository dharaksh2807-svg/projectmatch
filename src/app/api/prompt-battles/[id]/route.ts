import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const voteSchema = z.object({
  winnerId: z.enum(["modelA", "modelB", "tie"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const battle = await prisma.promptBattle.update({
      where: { id, userId: session.user.id },
      data: { winnerId: parsed.data.winnerId },
    });

    return NextResponse.json(battle);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to save vote or battle not found" },
      { status: 404 }
    );
  }
}
