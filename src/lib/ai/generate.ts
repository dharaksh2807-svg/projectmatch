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

export interface CustomAiKeys {
  google?: string;
  anthropic?: string;
  oss?: string;
}

export class AiProviderError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number = 500, code: string = "GENERATION_ERROR") {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
    this.code = code;
  }
}

export function sanitizeAiError(error: unknown, provider: string): AiProviderError {
  const errObj = error as { status?: number; statusCode?: number; message?: string } | undefined;
  const rawMsg = String(errObj?.message || error || "");
  const status = errObj?.status || errObj?.statusCode;

  const isAuth =
    status === 401 ||
    status === 403 ||
    /invalid api key|api key not valid|unauthorized|authentication|forbidden|invalid_api_key|permission_denied/i.test(rawMsg);

  if (isAuth) {
    return new AiProviderError(
      `Invalid or unauthorized API key for ${provider}. Please verify your BYOK credentials in settings.`,
      401,
      "INVALID_API_KEY"
    );
  }

  const isRateLimit =
    status === 429 ||
    /rate limit|quota|resource_exhausted|too many requests/i.test(rawMsg);

  if (isRateLimit) {
    return new AiProviderError(
      `Rate limit or quota exceeded for ${provider}. Please wait a moment or check your account quota.`,
      429,
      "RATE_LIMITED"
    );
  }

  // Scrub any sensitive key patterns
  const scrubbed = rawMsg
    .replace(/(?:key|token|api_key|apikey)=([a-zA-Z0-9_\-]+)/gi, "$1=[REDACTED]")
    .replace(/sk-[a-zA-Z0-9_\-]{15,}/gi, "sk-[REDACTED]")
    .replace(/AIza[a-zA-Z0-9_\-]{20,}/gi, "AIza[REDACTED]");

  return new AiProviderError(
    `${provider} request failed: ${scrubbed || "Generation failed"}`,
    status && status >= 400 && status < 600 ? status : 500,
    "PROVIDER_ERROR"
  );
}

export async function generateStream(params: {
  modelId: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  temperature: number;
  userId?: string;
  customKeys?: CustomAiKeys;
}): Promise<ReadableStream> {
  const modelConfig = AI_MODELS[params.modelId];
  if (!modelConfig) {
    throw new AiProviderError("Model provider not supported", 400, "INVALID_MODEL");
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
    const apiKey = params.customKeys?.google?.trim() || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AiProviderError(
        "Google Gemini API key is missing. Please configure your key in BYOK settings.",
        401,
        "MISSING_KEY"
      );
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
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
            controller.error(sanitizeAiError(error, "Google Gemini"));
          }
        },
      });
    } catch (err) {
      throw sanitizeAiError(err, "Google Gemini");
    }
  }

  if (provider === "anthropic") {
    const apiKey = params.customKeys?.anthropic?.trim() || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AiProviderError(
        "Anthropic Claude API key is missing. Please configure your key in BYOK settings.",
        401,
        "MISSING_KEY"
      );
    }

    try {
      const anthropic = new Anthropic({ apiKey });

      const MAX_HISTORY = 15;
      const recentMessages = buildContextWindow(params.messages, MAX_HISTORY);
      
      const anthropicMessages = recentMessages.map((m) => {
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
            controller.error(sanitizeAiError(error, "Anthropic Claude"));
          }
        },
      });
    } catch (err) {
      throw sanitizeAiError(err, "Anthropic Claude");
    }
  }

  if (provider === "oss") {
    const customKey = params.customKeys?.oss?.trim();
    const apiKey = customKey || process.env.OSS_API_KEY || "dummy";
    const baseURL = process.env.OSS_API_BASE_URL || (customKey && customKey.startsWith("sk-") && !customKey.startsWith("sk-ant-") ? undefined : "https://api.together.xyz/v1");

    try {
      const openai = new OpenAI({
        baseURL,
        apiKey,
      });

      const MAX_HISTORY = 15;
      const recentMessages = buildContextWindow(params.messages, MAX_HISTORY);

      const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: finalSystemPrompt },
        ...recentMessages.map((m) => {
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
            controller.error(sanitizeAiError(error, "OpenAI / OSS"));
          }
        },
      });
    } catch (err) {
      throw sanitizeAiError(err, "OpenAI / OSS");
    }
  }

  throw new AiProviderError("Model provider not supported", 400, "INVALID_MODEL");
}
