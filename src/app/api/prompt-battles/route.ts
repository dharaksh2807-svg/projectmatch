import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateStream } from "@/lib/ai/generate";
import { z } from "zod";

const battleSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(2000, "Prompt is too long"),
  modelAId: z.string().cuid(),
  modelBId: z.string().cuid(),
});

async function readStreamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = battleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const { prompt, modelAId, modelBId } = parsed.data;

  // Validate that both models exist
  const models = await prisma.aIModel.findMany({
    where: { id: { in: [modelAId, modelBId] }, isActive: true },
  });

  if (models.length !== 2) {
    return NextResponse.json({ error: "One or both models are invalid/inactive" }, { status: 400 });
  }

  try {
    // We run both generation streams in parallel to save time
    const [streamA, streamB] = await Promise.all([
      generateStream({
        modelId: modelAId,
        systemPrompt: "You are a helpful, extremely intelligent AI assistant. Provide the best possible response.",
        messages: [{ role: "USER", content: prompt }],
        temperature: 0.7,
      }),
      generateStream({
        modelId: modelBId,
        systemPrompt: "You are a helpful, extremely intelligent AI assistant. Provide the best possible response.",
        messages: [{ role: "USER", content: prompt }],
        temperature: 0.7,
      }),
    ]);

    // Await both streams fully
    const [responseA, responseB] = await Promise.all([
      readStreamToString(streamA),
      readStreamToString(streamB),
    ]);

    // Save the battle to DB
    const battle = await prisma.promptBattle.create({
      data: {
        userId: session.user.id,
        prompt,
        modelAId,
        modelBId,
        responseA,
        responseB,
      },
    });

    return NextResponse.json(battle);
  } catch (error: any) {
    console.error("Prompt battle generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate responses" },
      { status: 500 }
    );
  }
}
