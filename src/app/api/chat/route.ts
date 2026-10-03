import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkChatRateLimit } from "@/lib/redis";
import { generateStream } from "@/lib/ai/generate";
import { z } from "zod";

const chatSchema = z.object({
  agentId: z.string().cuid("agentId must be a valid CUID"),
  message: z
    .string()
    .min(1, "message cannot be empty")
    .max(8000, "message must be ≤ 8000 characters")
    .trim(),
  chatId: z.string().cuid("chatId must be a valid CUID").optional(),
});

/**
 * POST /api/chat
 * Auth + rate-limited + Zod-validated.
 * Saves a user message and creates/continues a Chat session.
 */
export async function POST(req: NextRequest) {
  try {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // 2. Rate limiting — 20 requests per minute per user
  const rateLimit = await checkChatRateLimit(userId);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before sending another message." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateLimit.reset ?? 60000) / 1000)) },
      }
    );
  }

  // 3. Parse + validate body with Zod
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = chatSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { agentId, message, chatId } = parseResult.data;

  try {
    // 4. Validate agent access — must own it or it must be public
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (agent.userId !== userId && !agent.isPublic) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 5. Create or reuse chat session
    let chat;
    if (chatId) {
      chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
      if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }
    } else {
      // Auto-title from first 60 chars of the first message
      const title = message.trim().slice(0, 60) + (message.length > 60 ? "…" : "");
      chat = await prisma.chat.create({ data: { userId, agentId, title } });
    }

    // 6. Save the user's message
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "USER",
        content: message.trim(),
      },
    });

    // 7. Fetch full message history for the chat
    const history = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "asc" },
    });

    const messages = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 8. Generate stream
    const stream = await generateStream({
      modelId: agent.modelId,
      systemPrompt: agent.systemPrompt,
      messages,
      temperature: agent.temperature,
      userId,
    });

    // 9. Intercept stream to save assistant response
    const [clientStream, dbStream] = stream.tee();

    // Process dbStream in the background to save the message
    (async () => {
      try {
        const reader = dbStream.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
        fullResponse += decoder.decode();

        await prisma.message.create({
          data: {
            chatId: chat.id,
            role: "ASSISTANT",
            content: fullResponse,
          },
        });
      } catch (err) {
        console.error("Failed to save assistant message", err);
      }
    })();

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Chat-Id": chat.id,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to process chat" }, { status: 500 });
  }
  } catch (outerErr) {
    console.error("POST /api/chat unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
