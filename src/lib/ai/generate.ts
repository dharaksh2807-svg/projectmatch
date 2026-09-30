import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AI_MODELS } from "./providers";
import { prisma } from "@/lib/prisma";
import { buildContextString, CompressedMetadata } from "@/lib/integrations";

/**
 * Builds a context-aware message window that preserves long-term memory.
 *
 * Strategy:
 *  1. If all messages fit within `maxHistory`, return them unchanged.
 *  2. Otherwise, keep message[0] (the user's original question/intent),
 *     keep the last `maxHistory - 2` messages (recent conversational context),
 *     and replace the pruned middle segment with a single SYSTEM message
 *     that summarizes what was discussed, so the AI doesn't lose context.
 *
 * The summary is intentionally token-efficient:
 *   - Counts user vs assistant turns pruned
 *   - Extracts the first 80 chars of each pruned message as "topic hints"
 */
function buildContextWindow(
  messages: { role: string; content: string }[],
  maxHistory: number
): { role: string; content: string }[] {
  if (messages.length <= maxHistory) return messages;

  const first = messages[0];
  // Reserve 2 slots: first message + the injected summary
  const tailCount = Math.max(1, maxHistory - 2);
  const tail = messages.slice(-tailCount);

  // Everything between first and tail is "pruned"
  const prunedStart = 1;
  const prunedEnd = messages.length - tailCount;
  const pruned = messages.slice(prunedStart, prunedEnd);

  // Build a compressed summary of pruned turns
  let userTurns = 0;
  let assistantTurns = 0;
  const topicHints: string[] = [];

  for (const msg of pruned) {
    const role = msg.role.toUpperCase();
    if (role === "USER") userTurns++;
    else assistantTurns++;
    // Extract a short topic hint from each message
    const snippet = msg.content.replace(/\s+/g, " ").trim().slice(0, 80);
    if (snippet.length > 0) {
      topicHints.push(`[${role === "USER" ? "U" : "A"}] ${snippet}`);
    }
  }

  const summaryLines = [
    `[CONTEXT SUMMARY] ${pruned.length} messages pruned (${userTurns} user, ${assistantTurns} assistant).`,
  ];

  if (topicHints.length > 0) {
    // Limit to 8 topic hints max to stay token-efficient
    const displayed = topicHints.slice(0, 8);
    summaryLines.push("Topics covered:");
    for (const hint of displayed) {
      summaryLines.push(`  • ${hint}`);
    }
    if (topicHints.length > 8) {
      summaryLines.push(`  … and ${topicHints.length - 8} more turns.`);
    }
  }

  const summaryMessage = {
    role: "SYSTEM",
    content: summaryLines.join("\n"),
  };

  return [first, summaryMessage, ...tail];
}

export async function generateStream(params: {
  modelId: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  temperature: number;
  userId?: string;
}): Promise<ReadableStream> {
  const modelConfig = AI_MODELS[params.modelId];
  if (!modelConfig) {
    throw new Error("Model provider not supported");
  }

  const { provider, modelString } = modelConfig;

  let finalSystemPrompt = params.systemPrompt;

  // If we have a userId, fetch their connections and inject compressed context
  if (params.userId) {
    const connections = await prisma.userConnection.findMany({
      where: { userId: params.userId },
    });

    if (connections.length > 0) {
      const metaMap: Record<string, CompressedMetadata> = {};
      for (const conn of connections) {
        if (conn.metadata) {
          metaMap[conn.platform] = conn.metadata as unknown as CompressedMetadata;
        }
      }
      const contextString = buildContextString(metaMap);
      if (contextString) {
        finalSystemPrompt = `${contextString}\n\n${finalSystemPrompt}`;
      }
    }
  }

  if (provider === "google") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: modelString,
      systemInstruction: finalSystemPrompt,
      generationConfig: {
        temperature: params.temperature,
      },
    });

    const MAX_HISTORY = 10;
    const recentMessages = buildContextWindow(params.messages, MAX_HISTORY);
    
    const contents = recentMessages.map((m) => {
      // Gemini only supports "user" | "model". SYSTEM summaries → "user".
      const role = m.role.toUpperCase();
      return {
        role: role === "USER" || role === "SYSTEM" ? "user" : "model",
        parts: [{ text: m.content }],
      };
    });

    const result = await model.generateContentStream({ contents });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is missing");
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const MAX_HISTORY = 15;
    const recentMessages = buildContextWindow(params.messages, MAX_HISTORY);
    
    const anthropicMessages = recentMessages.map((m) => {
      // Anthropic only supports "user" | "assistant". SYSTEM summaries → "user".
      const role = m.role.toUpperCase();
      return {
        role: (role === "USER" || role === "SYSTEM"
          ? "user"
          : "assistant") as "user" | "assistant",
        content: m.content,
      };
    });

    const stream = await anthropic.messages.create({
      model: modelString,
      system: finalSystemPrompt,
      messages: anthropicMessages,
      temperature: params.temperature,
      max_tokens: 4096,
      stream: true,
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  if (provider === "oss") {
    const openai = new OpenAI({
      baseURL: process.env.OSS_API_BASE_URL || "https://api.together.xyz/v1",
      apiKey: process.env.OSS_API_KEY || "dummy",
    });

    const MAX_HISTORY = 15;
    const recentMessages = buildContextWindow(params.messages, MAX_HISTORY);

    const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: finalSystemPrompt },
      ...recentMessages.map((m) => {
        // OpenAI supports "system" natively — use it for context summaries
        const role = m.role.toUpperCase();
        return {
          role: (role === "SYSTEM"
            ? "system"
            : role === "USER"
              ? "user"
              : "assistant") as "system" | "user" | "assistant",
          content: m.content,
        };
      }),
    ];

    const stream = await openai.chat.completions.create({
      model: modelString,
      messages: openaiMessages,
      temperature: params.temperature,
      stream: true,
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  throw new Error("Model provider not supported");
}
