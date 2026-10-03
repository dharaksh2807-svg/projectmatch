import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redis, userNotificationsChannel } from "@/lib/redis";

/**
 * GET /api/notifications/stream
 * Server-Sent Events (SSE) endpoint for global real-time notifications.
 *
 * Subscribes to the authenticated user's notification channel in Redis
 * and pushes events (new messages, applications, accept/reject) as they arrive.
 *
 * Uses Upstash-compatible polling (GET key) since Upstash REST doesn't
 * support blocking SUBSCRIBE. Follows the same pattern as
 * /api/conversations/[id]/stream.
 *
 * Usage:
 *   const es = new EventSource("/api/notifications/stream");
 *   es.addEventListener("notification", (e) => { ... });
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    const channel = userNotificationsChannel(userId);

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
        send(
          "connected",
          JSON.stringify({ userId, channel, ts: Date.now() })
        );

        // Heartbeat every 30s to keep the connection alive
        const heartbeat = setInterval(() => {
          try {
            send("ping", JSON.stringify({ ts: Date.now() }));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30_000);

        if (redis) {
          // Poll the user's notification channel key for new payloads.
          // Each published notification overwrites the :latest key
          // (TTL 120s), so we compare against the last value we saw.
          const pollKey = `${channel}:latest`;
          let lastSeen = "";

          const pollInterval = setInterval(async () => {
            try {
              const latest = await redis!.get<string>(pollKey);
              if (latest && latest !== lastSeen) {
                lastSeen = latest;
                send("notification", latest);
              }
            } catch {
              // Silently continue — transient Redis errors shouldn't kill the stream
            }
          }, 1500); // Poll every 1.5s (matches conversation stream cadence)

          req.signal.addEventListener("abort", () => {
            clearInterval(heartbeat);
            clearInterval(pollInterval);
            controller.close();
          });
        } else {
          // No Redis configured: keep stream alive with heartbeats only.
          // Client can fall back to periodic GET /api/notifications.
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
  } catch (outerErr) {
    console.error(
      "GET /api/notifications/stream unhandled error:",
      outerErr
    );
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
