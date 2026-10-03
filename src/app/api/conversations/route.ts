import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createConversationSchema = z.object({
  userId: z.string().cuid("userId must be a valid CUID"),
  projectId: z.string().cuid("projectId must be a valid CUID").optional(),
});

/**
 * GET /api/conversations
 * List all direct conversations for the current user,
 * including the other participant's info and the last message.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await prisma.directConversation.findMany({
      where: {
        OR: [
          { userOneId: session.user.id },
          { userTwoId: session.user.id },
        ],
      },
      include: {
        userOne: {
          select: { id: true, name: true, image: true, email: true },
        },
        userTwo: {
          select: { id: true, name: true, image: true, email: true },
        },
        project: {
          select: { id: true, title: true, projectType: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            isRead: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Transform to a cleaner response — identify "the other user"
    const result = conversations.map((c) => {
      const otherUser =
        c.userOneId === session.user.id ? c.userTwo : c.userOne;
      const lastMessage = c.messages[0] ?? null;
      const unread =
        lastMessage &&
        !lastMessage.isRead &&
        lastMessage.senderId !== session.user.id;

      return {
        id: c.id,
        otherUser,
        project: c.project,
        lastMessage,
        hasUnread: !!unread,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/conversations failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create (or retrieve existing) a direct conversation with another user.
 * Optionally link it to a project for context.
 */
export async function POST(req: NextRequest) {
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

  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { userId: otherUserId, projectId } = parsed.data;

  if (otherUserId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot start a conversation with yourself" },
      { status: 422 }
    );
  }

  // Verify the other user exists
  const otherUser = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true },
  });
  if (!otherUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // Normalize user order so the unique constraint works both ways:
    // always store the lexicographically smaller ID as userOneId.
    const [userOneId, userTwoId] =
      session.user.id < otherUserId
        ? [session.user.id, otherUserId]
        : [otherUserId, session.user.id];

    // Upsert: return existing conversation or create a new one
    const conversation = await prisma.directConversation.upsert({
      where: {
        userOneId_userTwoId: { userOneId, userTwoId },
      },
      update: {},
      create: {
        userOneId,
        userTwoId,
        projectId: projectId ?? null,
      },
      include: {
        userOne: {
          select: { id: true, name: true, image: true, email: true },
        },
        userTwo: {
          select: { id: true, name: true, image: true, email: true },
        },
        project: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json(conversation, { status: 200 });
  } catch (err) {
    console.error("POST /api/conversations failed:", err);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
