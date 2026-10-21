import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { DashboardView, type DashboardStats } from "@/components/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | ProjectMatch",
  description: "Your ProjectMatch workspace — projects, applications, teammates, and AI-powered recommendations.",
};

function computeProfileCompleteness(user: {
  name: string | null;
  bio: string | null;
  skills: string[];
  experienceLevel: string | null;
  availability: string | null;
  resumeUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  leetcodeUrl: string | null;
  portfolioUrl: string | null;
  previousProjects?: Array<{ id: string }>;
}): { score: number; missing: string[] } {
  const missing: string[] = [];
  let points = 0;

  if (user.name) points += 10;
  else missing.push("Full Name");

  if (user.bio && user.bio.trim().length > 10) points += 10;
  else missing.push("Bio / About");

  if (user.skills && user.skills.length >= 3) points += 20;
  else missing.push("At least 3 skills");

  if (user.experienceLevel) points += 10;
  else missing.push("Experience Level");

  if (user.availability) points += 10;
  else missing.push("Availability");

  if (user.resumeUrl) points += 10;
  else missing.push("Google Drive Resume / CV");

  if (user.githubUrl || user.linkedinUrl || user.leetcodeUrl || user.portfolioUrl) points += 10;
  else missing.push("GitHub or Tech Profile link");

  if (user.previousProjects && user.previousProjects.length > 0) points += 20;
  else missing.push("Previous Projects / Proof of Work (Drive/Demo)");

  return { score: Math.min(100, points), missing };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Ensure we have a valid userId
  let userId = (session.user as { id?: string }).id;
  if (!userId && session.user.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    userId = dbUser?.id;
  }

  if (!userId) {
    redirect("/login");
  }

  let serializedData;
  try {
    // Run parallel database queries
    const [
      user,
      ownedProjects,
      sentApplications,
      inboundPendingApps,
      activeHackathons,
      notifications,
      unreadNotificationsCount,
      conversations,
      unreadMessagesCount,
      promptBattlesCount,
      rawRecommendedRoles,
      savedSearches,
    ] = await Promise.all([
      // 1. User Profile
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          bio: true,
          skills: true,
          experienceLevel: true,
          availability: true,
          timezone: true,
          reputationScore: true,
          portfolioUrl: true,
          linkedinUrl: true,
          githubUrl: true,
          leetcodeUrl: true,
          codeforcesUrl: true,
          hackerrankUrl: true,
          kaggleUrl: true,
          resumeUrl: true,
          previousProjects: {
            select: { id: true, title: true, driveUrl: true, projectUrl: true, fileType: true },
          },
        },
      }),

      // 2. Owned Projects
      prisma.project.findMany({
        where: { ownerId: userId },
        include: {
          roles: {
            select: {
              id: true,
              title: true,
              requiredSkills: true,
              requiredExperienceLevel: true,
              timeCommitment: true,
              headcount: true,
              filledCount: true,
              isOpen: true,
            },
          },
          applications: {
            select: {
              id: true,
              status: true,
            },
          },
          hackathon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),

      // 3. Sent Applications
      prisma.application.findMany({
        where: { userId },
        include: {
          role: {
            select: {
              id: true,
              title: true,
              requiredSkills: true,
              timeCommitment: true,
              isOpen: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              projectType: true,
              duration: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  reputationScore: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),

      // 4. Inbound Applications for Owned Projects (Pending review)
      prisma.application.findMany({
        where: {
          project: { ownerId: userId },
          status: "PENDING",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              skills: true,
              experienceLevel: true,
              reputationScore: true,
              resumeUrl: true,
              githubUrl: true,
            },
          },
          role: {
            select: {
              id: true,
              title: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),

      // 5. Active Hackathons
      prisma.hackathon.findMany({
        orderBy: { startDate: "asc" },
        take: 4,
        include: {
          _count: {
            select: { projects: true },
          },
        },
      }),

      // 6. Recent Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),

      // 7. Unread Notifications Count
      prisma.notification.count({
        where: { userId, isRead: false },
      }),

      // 8. Direct Conversations
      prisma.directConversation.findMany({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
        },
        include: {
          userOne: { select: { id: true, name: true, image: true } },
          userTwo: { select: { id: true, name: true, image: true } },
          project: { select: { id: true, title: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
              isRead: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),

      // 9. Unread Messages Count
      prisma.directMessage.count({
        where: {
          conversation: {
            OR: [{ userOneId: userId }, { userTwoId: userId }],
          },
          senderId: { not: userId },
          isRead: false,
        },
      }),

      // 10. Prompt Battles Count
      prisma.promptBattle.count({
        where: { userId },
      }),

      // 11. Open Roles on Published Projects (for recommendations)
      prisma.role.findMany({
        where: {
          isOpen: true,
          project: {
            isPublished: true,
            ownerId: { not: userId },
          },
        },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              projectType: true,
              duration: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  reputationScore: true,
                },
              },
            },
          },
        },
        take: 16,
        orderBy: { createdAt: "desc" },
      }),

      // 12. User Saved Searches
      prisma.savedSearch.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    if (!user) {
      redirect("/login");
    }

    // Compute real matching score for recommended roles
    const userSkillsSet = new Set((user.skills || []).map((s) => s.toLowerCase().trim()));
    const recommendedRoles = rawRecommendedRoles.map((role) => {
      const reqSkills = role.requiredSkills || [];
      if (reqSkills.length === 0) {
        return {
          ...role,
          matchPercent: 70,
          matchingSkillsCount: 0,
          matchingSkills: [],
        };
      }
      const matched = reqSkills.filter((s) => userSkillsSet.has(s.toLowerCase().trim()));
      const matchPercent = Math.round((matched.length / reqSkills.length) * 100);
      return {
        ...role,
        matchPercent: matchPercent > 0 ? matchPercent : 20,
        matchingSkillsCount: matched.length,
        matchingSkills: matched,
      };
    });

    recommendedRoles.sort((a, b) => {
      if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
      return b.matchingSkillsCount - a.matchingSkillsCount;
    });

    // Compute stats
    const { score: profileCompleteness, missing: missingProfileFields } = computeProfileCompleteness(user);
    const activeRolesCount = ownedProjects.reduce(
      (acc, p) => acc + p.roles.filter((r) => r.isOpen).length,
      0
    );
    const acceptedApplicationsCount = sentApplications.filter((a) => a.status === "ACCEPTED").length;
    const pendingApplicationsCount = sentApplications.filter((a) => a.status === "PENDING").length;

    // Transform conversations so "otherUser" is always the counterpart
    const formattedConversations = conversations.map((c) => ({
      id: c.id,
      updatedAt: c.updatedAt.toISOString(),
      otherUser: c.userOneId === userId ? c.userTwo : c.userOne,
      project: c.project,
      lastMessage: c.messages[0]
        ? {
            id: c.messages[0].id,
            content: c.messages[0].content,
            createdAt: c.messages[0].createdAt.toISOString(),
            senderId: c.messages[0].senderId,
            isRead: c.messages[0].isRead,
          }
        : null,
    }));

    const stats: DashboardStats = {
      ownedProjectsCount: ownedProjects.length,
      activeRolesCount,
      applicationsSentCount: sentApplications.length,
      acceptedApplicationsCount,
      pendingApplicationsCount,
      inboundPendingCount: inboundPendingApps.length,
      reputationScore: user.reputationScore ?? 50,
      unreadMessagesCount,
      unreadNotificationsCount,
      activeHackathonsCount: activeHackathons.length,
      promptBattlesCount,
      profileCompleteness,
      missingProfileFields,
    };

    // Serialize all data to plain JSON to guarantee no Date object or prototype leaks across RSC boundary (Error #441)
    serializedData = JSON.parse(
      JSON.stringify({
        user,
        stats,
        ownedProjects,
        sentApplications,
        inboundPendingApps,
        recommendedRoles: recommendedRoles.slice(0, 6),
        activeHackathons,
        recentConversations: formattedConversations,
        recentNotifications: notifications,
        savedSearches: savedSearches || [],
      })
    );
  } catch (error) {
    console.error("DashboardPage error loading data:", error);
    throw error; // Will be caught by src/app/(dashboard)/error.tsx
  }

  return <DashboardView {...serializedData} />;
}