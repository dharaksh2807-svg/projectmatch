import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

type Params = Promise<{ id: string }>;

/**
 * GET /api/conversations/[id]/stream
 * Server-Sent Events (SSE) endpoint for real-time message delivery.
 *
 * Uses Redis Pub/Sub to listen for new messages on the conversation channel.
 * Falls back to a simple polling heartbeat when Redis is unavailable.
 *
 * The client connects via:
 *   const es = new EventSource("/api/conversations/<id>/stream");
 *   es.addEventListener("message", (e) => { ... });
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify the user is a participant
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    select: { userOneId: true, userTwoId: true },
  });

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  if (
    conversation.userOneId !== session.user.id &&
    conversation.userTwoId !== session.user.id
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const channel = `dm:conversation:${conversationId}`;

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper to send an SSE event
      function send(event: string, data: string) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${data}\n\n`)
        );
      }

      // Send initial connection confirmation
      send("connected", JSON.stringify({ conversationId, userId: session.user.id }));

      // Heartbeat to keep the connection alive (every 30s)
      const heartbeat = setInterval(() => {
        try {
          send("ping", JSON.stringify({ ts: Date.now() }));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      if (redis) {
        // Subscribe to the Redis channel for this conversation.
        // Upstash REST-based Redis does not support traditional blocking SUBSCRIBE,
        // so we poll with a short interval using a list-based approach.
        // We use a simple polling strategy with Redis GET/SET for Upstash compat.
        const pollKey = `${channel}:latest`;
        let lastSeenId = "";

        const pollInterval = setInterval(async () => {
          try {
            const latest = await redis!.get<string>(pollKey);
            if (latest && latest !== lastSeenId) {
              lastSeenId = latest;
              send("message", latest);
            }
          } catch {
            // Silently continue — connection may have dropped
          }
        }, 1500); // Poll every 1.5 seconds

        // Clean up on abort
        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          clearInterval(pollInterval);
          controller.close();
        });
      } else {
        // No Redis: just keep the SSE alive with heartbeats
        // The client can fall back to refetching messages on an interval
        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          controller.close();
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
