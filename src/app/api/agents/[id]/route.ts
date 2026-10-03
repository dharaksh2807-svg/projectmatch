import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAgentMutationRateLimit } from "@/lib/redis";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prisma cascades deletes if set up, or we might need to delete chats first
    // Assuming cascade is on for Agent -> Chat
    await prisma.agent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
  } catch (outerErr) {
    console.error("DELETE /api/agents/[id] unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Zod schema for strict input validation on agent updates
const updateAgentSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100, "Name too long").optional(),
  systemPrompt: z.string().max(10000, "System prompt too long").optional(),
  modelId: z.string().min(1).max(100).optional(),
  temperature: z.number().min(0, "Temperature must be >= 0").max(2, "Temperature must be <= 2").optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Rate limit: 10 mutations per minute per authenticated user.
  // Checked after auth so we use userId (more accurate than IP for authenticated routes).
  const rl = await checkAgentMutationRateLimit(session.user.id);
  if (!rl.success) {
    const retryAfterSec = rl.reset ? Math.ceil((rl.reset - Date.now()) / 1000) : 60;
    return NextResponse.json(
      {
        error: "Too Many Requests",
        message: "You have exceeded the rate limit. Please try again later.",
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const body = await req.json();

    // Strict Zod validation — reject malformed payloads before touching DB
    const parsed = updateAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, systemPrompt, modelId, temperature } = parsed.data;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedAgent = await prisma.agent.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(modelId !== undefined && { modelId }),
        ...(temperature !== undefined && { temperature }),
      },
    });

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
  } catch (outerErr) {
    console.error("PUT /api/agents/[id] unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
