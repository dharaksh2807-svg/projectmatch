import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  checkDmRateLimit,
  publishEvent,
  conversationChannel,
} from "@/lib/redis";

type Params = Promise<{ id: string }>;

const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message must be ≤ 5000 characters"),
});

/**
 * GET /api/conversations/[id]/messages
 * Fetch messages for a conversation (paginated via cursor).
 * Also marks all unread messages from the other user as read.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  // Verify the user is a participant in this conversation
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    select: { userOneId: true, userTwoId: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (
    conversation.userOneId !== session.user.id &&
    conversation.userTwoId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pagination: cursor-based
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const take = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  try {
    const messages = await prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: take + 1, // fetch one extra to determine hasMore
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1, // skip the cursor itself
          }
        : {}),
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    const hasMore = messages.length > take;
    if (hasMore) messages.pop(); // remove the extra

    // Mark unread messages from the other user as read
    await prisma.directMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: session.user.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      messages,
      nextCursor: hasMore ? messages[messages.length - 1]?.id : null,
    });
  } catch (err) {
    console.error("GET /api/conversations/[id]/messages failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
  } catch (outerErr) {
    console.error("GET /api/conversations/[id]/messages unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Send a message in a conversation.
 * Publishes a real-time event via Redis for SSE listeners.
 * Creates a notification for the recipient.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting
  const rl = await checkDmRateLimit(session.user.id);
  if (!rl.success) {
    const retryAfterSec = rl.reset
      ? Math.ceil((rl.reset - Date.now()) / 1000)
      : 60;
    return NextResponse.json(
      {
        error: "Too Many Requests",
        message: "You're sending messages too fast. Please slow down.",
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

  const { id: conversationId } = await params;

  // Verify participation
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    select: { userOneId: true, userTwoId: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (
    conversation.userOneId !== session.user.id &&
    conversation.userTwoId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { content } = parsed.data;

  const recipientId =
    conversation.userOneId === session.user.id
      ? conversation.userTwoId
      : conversation.userOneId;

  try {
    // Create message + update conversation timestamp + notify recipient
    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          conversationId,
          senderId: session.user.id,
          content,
        },
        include: {
          sender: {
            select: { id: true, name: true, image: true },
          },
        },
      }),
      prisma.directConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      prisma.notification.create({
        data: {
          userId: recipientId,
          type: "NEW_MESSAGE",
          title: `New message from ${session.user.name ?? "someone"}`,
          body:
            content.length > 100 ? content.slice(0, 100) + "…" : content,
          link: `/chat/${conversationId}`,
          metadata: { conversationId, senderId: session.user.id },
        },
      }),
    ]);

    // Publish real-time event via Redis
    await publishEvent(conversationChannel(conversationId), {
      type: "NEW_MESSAGE",
      message,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error("POST /api/conversations/[id]/messages failed:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
  } catch (outerErr) {
    console.error("POST /api/conversations/[id]/messages unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
