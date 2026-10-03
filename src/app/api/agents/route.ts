import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─────────────────────────────────────────────
// Strict Zod schema — rejects XSS vectors in name,
// trims whitespace, and enforces sane boundaries.
// ─────────────────────────────────────────────
const agentSchema = z.object({
  name: z
    .string()
    .min(1, "Agent name cannot be empty")
    .max(50, "Agent name must be ≤ 50 characters")
    .trim()
    .regex(
      /^[^<>"'`;(){}]*$/,
      "Agent name contains disallowed characters"
    ),
  systemPrompt: z
    .string()
    .min(1, "System prompt cannot be empty")
    .max(4000, "System prompt must be ≤ 4000 characters")
    .trim(),
  modelId: z.string().cuid("modelId must be a valid CUID"),
  temperature: z
    .number()
    .min(0, "Temperature must be ≥ 0")
    .max(2, "Temperature must be ≤ 2")
    .default(0.7),
  isPublic: z.boolean().default(false),
});

/** POST /api/agents — create a new agent */
export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = agentSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { name, systemPrompt, modelId, temperature, isPublic } = parseResult.data;

  try {
    // Verify the referenced model actually exists and is active
    const modelRecord = await prisma.aIModel.findUnique({
      where: { id: modelId },
      select: { id: true, isActive: true },
    });
    if (!modelRecord) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }
    if (!modelRecord.isActive) {
      return NextResponse.json(
        { error: "Selected model is currently disabled" },
        { status: 422 }
      );
    }

    const agent = await prisma.agent.create({
      data: {
        userId: session.user.id,
        name,
        systemPrompt,
        modelId,
        temperature,
        isPublic,
      },
      include: { model: true },
    });
    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    console.error("POST /api/agents failed:", err);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("POST /api/agents unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** GET /api/agents — list all agents owned by the current user */
export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const agents = await prisma.agent.findMany({
      where: { userId: session.user.id },
      include: { model: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("GET /api/agents unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
