import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { publishEvent, userNotificationsChannel } from "@/lib/redis";
import { inviteAcceptedEmail } from "@/lib/mail";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

export interface GenerateInviteParams {
  projectId: string;
  inviterId: string;
  roleId?: string | null;
  expiresInDays?: number;
  maxUses?: number;
}

export interface AcceptInviteParams {
  rawToken: string;
  userId: string;
  roleId?: string | null;
  message?: string;
}

/**
 * Mask token for safe logging (never log full bearer tokens).
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/**
 * Generates an unpredictable high-entropy token (256-bit / 32-byte base64url)
 * and its SHA-256 hash.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Hashes a raw token with SHA-256.
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * In-memory fallback rate-limiter for invitation creation & redemption
 * (works in local dev & automated test environments when Redis is not present).
 */
const inMemoryRateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const entry = inMemoryRateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    inMemoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count, reset: entry.resetAt };
}

/**
 * Clear in-memory rate limits (useful for testing)
 */
export function resetMemoryRateLimits(): void {
  inMemoryRateLimits.clear();
}

/**
 * Create a team invitation.
 * Stores ONLY the sha256 hash of the token.
 * Returns the raw token once to the creator.
 */
export async function createTeamInvitation({
  projectId,
  inviterId,
  roleId,
  expiresInDays = 7,
  maxUses = 1,
}: GenerateInviteParams) {
  // Validate expiration period (default 7 days, allowed between 1 hour and 90 days)
  const safeDays = Math.min(Math.max(expiresInDays, 0.04), 90);
  const safeMaxUses = Math.min(Math.max(maxUses, 1), 100);

  // Check project existence and ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      roles: true,
      hackathon: {
        select: {
          id: true,
          name: true,
          maxTeamSize: true,
        },
      },
      applications: {
        where: { status: "ACCEPTED" },
        select: { id: true },
      },
    },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  if (project.ownerId !== inviterId) {
    throw new Error("UNAUTHORIZED_NOT_OWNER");
  }

  // If role specified, validate role
  if (roleId) {
    const role = project.roles.find((r) => r.id === roleId);
    if (!role) {
      throw new Error("ROLE_NOT_FOUND");
    }
    if (!role.isOpen || role.filledCount >= role.headcount) {
      throw new Error("ROLE_FULL");
    }
  }

  // Check hackathon max team size if applicable
  if (project.hackathon?.maxTeamSize) {
    const currentTeamSize = 1 + project.applications.length; // Owner + accepted
    if (currentTeamSize >= project.hackathon.maxTeamSize) {
      throw new Error("TEAM_CAPACITY_EXCEEDED");
    }
  }

  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.teamInvitation.create({
    data: {
      projectId,
      roleId: roleId || null,
      inviterId,
      tokenHash,
      expiresAt,
      maxUses: safeMaxUses,
      usesCount: 0,
      isRevoked: false,
    },
    include: {
      role: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return {
    invitation: {
      id: invitation.id,
      projectId: invitation.projectId,
      roleId: invitation.roleId,
      roleTitle: invitation.role?.title ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
      maxUses: invitation.maxUses,
      usesCount: invitation.usesCount,
      isRevoked: invitation.isRevoked,
      createdAt: invitation.createdAt.toISOString(),
    },
    token: rawToken,
  };
}

/**
 * List active & historical invitations for a project.
 * Authorized to project owner only.
 * NEVER returns raw token or tokenHash.
 */
export async function getProjectInvitations(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (project.ownerId !== userId) throw new Error("UNAUTHORIZED_NOT_OWNER");

  const invitations = await prisma.teamInvitation.findMany({
    where: { projectId },
    include: {
      role: {
        select: {
          id: true,
          title: true,
          isOpen: true,
          headcount: true,
          filledCount: true,
        },
      },
      redemptions: {
        select: {
          id: true,
          redeemedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  return invitations.map((inv) => {
    let status: "ACTIVE" | "EXPIRED" | "REVOKED" | "EXHAUSTED" = "ACTIVE";
    if (inv.isRevoked) {
      status = "REVOKED";
    } else if (now > inv.expiresAt) {
      status = "EXPIRED";
    } else if (inv.usesCount >= inv.maxUses) {
      status = "EXHAUSTED";
    }

    return {
      id: inv.id,
      projectId: inv.projectId,
      roleId: inv.roleId,
      roleTitle: inv.role?.title ?? null,
      roleIsOpen: inv.role?.isOpen ?? true,
      roleFilledCount: inv.role?.filledCount ?? 0,
      roleHeadcount: inv.role?.headcount ?? 1,
      expiresAt: inv.expiresAt.toISOString(),
      maxUses: inv.maxUses,
      usesCount: inv.usesCount,
      isRevoked: inv.isRevoked,
      revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
      status,
      createdAt: inv.createdAt.toISOString(),
      redemptions: inv.redemptions.map((r) => ({
        id: r.id,
        redeemedAt: r.redeemedAt.toISOString(),
        user: r.user,
      })),
    };
  });
}

/**
 * Revoke an active invitation.
 * Authorized to project owner only.
 */
export async function revokeTeamInvitation(
  projectId: string,
  invitationId: string,
  userId: string
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (project.ownerId !== userId) throw new Error("UNAUTHORIZED_NOT_OWNER");

  const invitation = await prisma.teamInvitation.findFirst({
    where: { id: invitationId, projectId },
  });

  if (!invitation) throw new Error("INVITATION_NOT_FOUND");

  const updated = await prisma.teamInvitation.update({
    where: { id: invitationId },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
    },
  });

  return { success: true, isRevoked: updated.isRevoked };
}

/**
 * Inspect an invitation by raw token (Public or Authenticated view).
 * Hashed before DB lookup to prevent exposing token.
 */
export async function inspectInvitationByToken(rawToken: string, currentUserId?: string) {
  if (!rawToken || typeof rawToken !== "string") {
    return { found: false, error: "INVALID_TOKEN" };
  }

  const tokenHash = hashInvitationToken(rawToken);

  const invitation = await prisma.teamInvitation.findUnique({
    where: { tokenHash },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          description: true,
          projectType: true,
          duration: true,
          techStack: true,
          isPublished: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
              bio: true,
              reputationScore: true,
            },
          },
          hackathon: {
            select: {
              id: true,
              name: true,
              minTeamSize: true,
              maxTeamSize: true,
            },
          },
          roles: {
            where: { isOpen: true },
            select: {
              id: true,
              title: true,
              description: true,
              requiredSkills: true,
              requiredExperienceLevel: true,
              timeCommitment: true,
              headcount: true,
              filledCount: true,
              isOpen: true,
            },
          },
          applications: {
            where: { status: "ACCEPTED" },
            select: {
              id: true,
              userId: true,
            },
          },
        },
      },
      role: {
        select: {
          id: true,
          title: true,
          description: true,
          requiredSkills: true,
          requiredExperienceLevel: true,
          timeCommitment: true,
          headcount: true,
          filledCount: true,
          isOpen: true,
        },
      },
      inviter: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  if (!invitation) {
    return { found: false, error: "INVALID_TOKEN" };
  }

  const now = new Date();
  const project = invitation.project;

  // Verify owner didn't lose authorization (owner must still own project)
  const isInviterStillOwner = project.ownerId === invitation.inviterId;

  // Determine capacity
  const acceptedCount = project.applications.length;
  const currentTeamSize = 1 + acceptedCount; // Owner + accepted
  const maxTeamSize = project.hackathon?.maxTeamSize ?? null;
  const isTeamFull = maxTeamSize !== null && currentTeamSize >= maxTeamSize;

  // Status computation
  let status:
    | "ACTIVE"
    | "EXPIRED"
    | "REVOKED"
    | "EXHAUSTED"
    | "ROLE_UNAVAILABLE"
    | "TEAM_FULL"
    | "PROJECT_UNAVAILABLE"
    | "OWNER_UNAUTHORIZED" = "ACTIVE";

  if (!isInviterStillOwner) {
    status = "OWNER_UNAUTHORIZED";
  } else if (!project.isPublished) {
    status = "PROJECT_UNAVAILABLE";
  } else if (invitation.isRevoked) {
    status = "REVOKED";
  } else if (now > invitation.expiresAt) {
    status = "EXPIRED";
  } else if (invitation.usesCount >= invitation.maxUses) {
    status = "EXHAUSTED";
  } else if (isTeamFull) {
    status = "TEAM_FULL";
  } else if (
    invitation.role &&
    (!invitation.role.isOpen || invitation.role.filledCount >= invitation.role.headcount)
  ) {
    status = "ROLE_UNAVAILABLE";
  }

  const isValid = status === "ACTIVE";

  // Check current user status if logged in
  let isCurrentUserOwner = false;
  let isCurrentUserMember = false;

  if (currentUserId) {
    isCurrentUserOwner = project.ownerId === currentUserId;
    isCurrentUserMember =
      isCurrentUserOwner ||
      project.applications.some((app) => app.userId === currentUserId);
  }

  return {
    found: true,
    isValid,
    status,
    invitation: {
      id: invitation.id,
      expiresAt: invitation.expiresAt.toISOString(),
      maxUses: invitation.maxUses,
      usesCount: invitation.usesCount,
      remainingUses: Math.max(0, invitation.maxUses - invitation.usesCount),
      roleSpecified: !!invitation.role,
      role: invitation.role,
    },
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      duration: project.duration,
      techStack: project.techStack,
      owner: project.owner,
      hackathon: project.hackathon,
      currentTeamSize,
      maxTeamSize,
      availableCapacity: maxTeamSize !== null ? Math.max(0, maxTeamSize - currentTeamSize) : null,
      availableRoles: project.roles.filter((r) => r.filledCount < r.headcount),
    },
    currentUser: currentUserId
      ? {
          isOwner: isCurrentUserOwner,
          isMember: isCurrentUserMember,
        }
      : null,
  };
}

/**
 * Accept a team invitation in a transaction-safe manner.
 * Protects against concurrent over-allocation with atomic updates
 * and transactional verification.
 */
export async function acceptTeamInvitation({
  rawToken,
  userId,
  roleId,
  message,
}: AcceptInviteParams) {
  if (!rawToken) throw new Error("INVALID_TOKEN");
  if (!userId) throw new Error("UNAUTHORIZED");

  const tokenHash = hashInvitationToken(rawToken);

  // Check user is valid and not banned
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isBanned: true },
  });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.isBanned) throw new Error("USER_BANNED");

  // Perform atomic transactional acceptance
  const result = await prisma.$transaction(
    async (tx) => {
      // 1. Fetch invitation
      const invitation = await tx.teamInvitation.findUnique({
        where: { tokenHash },
        include: {
          project: {
            include: {
              hackathon: {
                select: {
                  id: true,
                  name: true,
                  maxTeamSize: true,
                },
              },
            },
          },
          role: true,
        },
      });

      if (!invitation) {
        throw new Error("INVALID_TOKEN");
      }

      if (invitation.isRevoked) {
        throw new Error("INVITATION_REVOKED");
      }

      if (new Date() > invitation.expiresAt) {
        throw new Error("INVITATION_EXPIRED");
      }

      if (invitation.usesCount >= invitation.maxUses) {
        throw new Error("INVITATION_EXHAUSTED");
      }

      const project = invitation.project;

      // Project must be published/active
      if (!project.isPublished) {
        throw new Error("PROJECT_NOT_ACTIVE");
      }

      // Inviter must still be owner (Test case 14: owner losing authorization)
      if (project.ownerId !== invitation.inviterId) {
        throw new Error("OWNER_LOST_AUTHORIZATION");
      }

      // Check user is not project owner (owners cannot be teammates of their own project)
      if (project.ownerId === userId) {
        throw new Error("OWNER_CANNOT_JOIN");
      }

      // Check user is not already an accepted member of the team
      const existingAccepted = await tx.application.findFirst({
        where: {
          projectId: project.id,
          userId,
          status: "ACCEPTED",
        },
      });

      if (existingAccepted) {
        throw new Error("ALREADY_A_MEMBER");
      }

      // Target role resolution
      const targetRoleId = invitation.roleId || roleId;
      if (!targetRoleId) {
        throw new Error("ROLE_REQUIRED");
      }

      // Lock/verify the role
      const role = await tx.role.findFirst({
        where: {
          id: targetRoleId,
          projectId: project.id,
        },
      });

      if (!role) {
        throw new Error("ROLE_NOT_FOUND");
      }

      if (!role.isOpen || role.filledCount >= role.headcount) {
        throw new Error("ROLE_FULL");
      }

      // Check hackathon capacity limit if set
      if (project.hackathon?.maxTeamSize) {
        const acceptedCount = await tx.application.count({
          where: {
            projectId: project.id,
            status: "ACCEPTED",
          },
        });
        const currentTeamSize = 1 + acceptedCount; // Owner + teammates
        if (currentTeamSize >= project.hackathon.maxTeamSize) {
          throw new Error("TEAM_CAPACITY_EXCEEDED");
        }
      }

      // ATOMIC UPDATE 1: Increment invitation usesCount with condition
      // Guaranteeing that concurrent calls cannot both exceed maxUses
      const updatedInvite = await tx.teamInvitation.updateMany({
        where: {
          id: invitation.id,
          isRevoked: false,
          usesCount: { lt: invitation.maxUses },
          expiresAt: { gt: new Date() },
        },
        data: {
          usesCount: { increment: 1 },
        },
      });

      if (updatedInvite.count === 0) {
        throw new Error("INVITATION_EXHAUSTED");
      }

      // ATOMIC UPDATE 2: Increment role filledCount with condition
      // Guaranteeing that concurrent calls cannot both exceed role capacity
      const updatedRole = await tx.role.updateMany({
        where: {
          id: targetRoleId,
          isOpen: true,
          filledCount: { lt: role.headcount },
        },
        data: {
          filledCount: { increment: 1 },
        },
      });

      if (updatedRole.count === 0) {
        throw new Error("ROLE_FULL");
      }

      // If role is now filled to headcount, close it
      if (role.filledCount + 1 >= role.headcount) {
        await tx.role.update({
          where: { id: targetRoleId },
          data: { isOpen: false },
        });
      }

      // Record invitation redemption
      await tx.invitationRedemption.create({
        data: {
          invitationId: invitation.id,
          userId,
          roleId: targetRoleId,
        },
      });

      // Existing membership model: create or transition Application to ACCEPTED
      const existingApplication = await tx.application.findUnique({
        where: {
          userId_roleId: {
            userId,
            roleId: targetRoleId,
          },
        },
      });

      let application;
      if (existingApplication) {
        application = await tx.application.update({
          where: { id: existingApplication.id },
          data: {
            status: "ACCEPTED",
            message: message || existingApplication.message,
          },
        });
      } else {
        application = await tx.application.create({
          data: {
            userId,
            roleId: targetRoleId,
            projectId: project.id,
            status: "ACCEPTED",
            message: message || "Joined via secure invite link",
          },
        });
      }

      // Create notification for the project owner
      const notification = await tx.notification.create({
        data: {
          userId: project.ownerId,
          type: "INVITATION_ACCEPTED",
          title: "New Teammate Joined! 🎉",
          body: `${user.name || "A new teammate"} joined "${project.title}" as ${role.title} via invite link.`,
          link: `/projects/${project.id}`,
          metadata: {
            projectId: project.id,
            roleId: targetRoleId,
            applicationId: application.id,
            invitationId: invitation.id,
          },
        },
      });

      return {
        project,
        role,
        application,
        notification,
        ownerId: project.ownerId,
      };
    },
    {
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    }
  );

  // Outside transaction: real-time event & email notifications
  try {
    await publishEvent(
      userNotificationsChannel(result.ownerId),
      result.notification as unknown as Record<string, unknown>
    );
  } catch (pubErr) {
    console.error("Real-time notification publish failed:", pubErr);
  }

  // Auto-create P2P direct conversation between owner and new teammate
  try {
    const [userOneId, userTwoId] =
      userId < result.ownerId
        ? [userId, result.ownerId]
        : [result.ownerId, userId];

    await prisma.directConversation.upsert({
      where: {
        userOneId_userTwoId: { userOneId, userTwoId },
      },
      update: {},
      create: {
        userOneId,
        userTwoId,
        projectId: result.project.id,
      },
    });
  } catch (convErr) {
    console.error("Auto-create conversation failed:", convErr);
  }

  // Send email to project owner if configured
  try {
    const owner = await prisma.user.findUnique({
      where: { id: result.ownerId },
      select: { name: true, email: true },
    });

    if (owner?.email && process.env.RESEND_API_KEY) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000");

      const emailData = inviteAcceptedEmail({
        ownerName: owner.name || "Project Lead",
        candidateName: user.name || "Your new teammate",
        roleName: result.role.title,
        projectTitle: result.project.title,
        projectUrl: `${appUrl}/projects/${result.project.id}`,
      });

      await resend.emails
        .send({
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Project Match <onboarding@resend.dev>",
          to: [owner.email],
          subject: emailData.subject,
          html: emailData.html,
        })
        .catch(console.error);
    }
  } catch (emailErr) {
    console.error("Invite accepted email notification failed:", emailErr);
  }

  return {
    success: true,
    projectId: result.project.id,
    projectTitle: result.project.title,
    roleId: result.role.id,
    roleTitle: result.role.title,
  };
}
