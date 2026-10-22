import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  analyzeTeamSkillGaps,
  recommendComplementaryCandidates,
  TeamMemberInfo,
  ProjectCapabilityItem,
  CandidateEvaluationContext,
} from "@/lib/gap-analyzer";

type Params = Promise<{ id: string }>;

/**
 * GET /api/projects/[id]/gaps
 * 
 * Computes deterministic team skill-gap analysis, redundancy evaluation,
 * recruitment priorities, and explainable complementary candidate recommendations.
 * 
 * Authorization: Only authorized project owner and accepted team members.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;

    // Fetch project with owner, roles, accepted team members, and custom capability requirements
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
            skills: true,
            experienceLevel: true,
            reputationScore: true,
            availability: true,
            schedule: true,
            previousProjects: {
              select: { title: true, techStack: true },
            },
            reviewsReceived: {
              select: { rating: true, skillsEndorsed: true },
            },
          },
        },
        roles: {
          orderBy: { createdAt: "asc" },
        },
        applications: {
          where: { status: "ACCEPTED" },
          include: {
            role: { select: { id: true, title: true } },
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                skills: true,
                experienceLevel: true,
                reputationScore: true,
                availability: true,
                schedule: true,
                previousProjects: {
                  select: { title: true, techStack: true },
                },
                reviewsReceived: {
                  select: { rating: true, skillsEndorsed: true },
                },
              },
            },
          },
        },
        capabilityRequirements: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Authorization verification:
    // Only the project owner and accepted team members are authorized
    const isOwner = project.ownerId === currentUserId;
    const isAcceptedMember = project.applications.some((app) => app.user.id === currentUserId);

    if (!isOwner && !isAcceptedMember) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only authorized team members can view the skill-gap analysis." },
        { status: 403 }
      );
    }

    // Build unified team member list
    const teamMembers: TeamMemberInfo[] = [];

    // 1. Owner
    teamMembers.push({
      id: project.owner.id,
      name: project.owner.name,
      image: project.owner.image,
      roleTitle: "Project Lead",
      roleId: null,
      isOwner: true,
      skills: project.owner.skills || [],
      experienceLevel: project.owner.experienceLevel,
      reputationScore: project.owner.reputationScore,
      availability: project.owner.availability,
      hasSchedule: !!project.owner.schedule,
      weeklyHours: project.owner.schedule?.weeklyHours ?? null,
      endorsedSkills: project.owner.reviewsReceived.flatMap((r) => r.skillsEndorsed || []),
      previousProjectTechs: project.owner.previousProjects.flatMap((p) => p.techStack || []),
    });

    // 2. Accepted applicants
    for (const app of project.applications) {
      teamMembers.push({
        id: app.user.id,
        name: app.user.name,
        image: app.user.image,
        roleTitle: app.role.title,
        roleId: app.role.id,
        isOwner: false,
        skills: app.user.skills || [],
        experienceLevel: app.user.experienceLevel,
        reputationScore: app.user.reputationScore,
        availability: app.user.availability,
        hasSchedule: !!app.user.schedule,
        weeklyHours: app.user.schedule?.weeklyHours ?? null,
        endorsedSkills: app.user.reviewsReceived.flatMap((r) => r.skillsEndorsed || []),
        previousProjectTechs: app.user.previousProjects.flatMap((p) => p.techStack || []),
      });
    }

    // Map explicit requirements from DB
    const explicitRequirements: ProjectCapabilityItem[] = project.capabilityRequirements.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      importance: r.importance,
      requiredSkills: r.requiredSkills,
      minExperienceLevel: r.minExperienceLevel,
      targetRoleTitle: r.targetRoleTitle,
      description: r.description,
      isCustom: true,
    }));

    // Run deterministic gap analysis
    const gapAnalysis = analyzeTeamSkillGaps(
      {
        id: project.id,
        title: project.title,
        techStack: project.techStack,
        roles: project.roles,
      },
      teamMembers,
      explicitRequirements
    );

    // Fetch eligible candidates for complementary recommendation
    // Exclude existing team members, banned users
    const existingMemberIds = teamMembers.map((m) => m.id);

    const candidatesRaw = await prisma.user.findMany({
      where: {
        id: { notIn: existingMemberIds },
        isBanned: false,
      },
      select: {
        id: true,
        name: true,
        image: true,
        skills: true,
        experienceLevel: true,
        reputationScore: true,
        availability: true,
        isBanned: true,
        schedule: {
          select: { weeklyHours: true },
        },
        previousProjects: {
          select: { title: true, techStack: true },
        },
        reviewsReceived: {
          select: { rating: true, skillsEndorsed: true },
        },
        applications: {
          where: { projectId: project.id },
          select: { roleId: true, status: true, projectId: true },
        },
      },
      take: 60,
    });

    const candidates: CandidateEvaluationContext[] = candidatesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      image: c.image,
      skills: c.skills || [],
      experienceLevel: c.experienceLevel,
      reputationScore: c.reputationScore,
      availabilityHours: c.schedule?.weeklyHours ?? (c.availability ? 15 : null),
      availabilityDuration: null,
      interests: [],
      isBanned: c.isBanned,
      previousProjects: c.previousProjects,
      reviewsReceived: c.reviewsReceived,
      applications: c.applications,
    }));

    // Generate complementary candidate recommendations
    const recommendations = recommendComplementaryCandidates(
      candidates,
      {
        id: project.id,
        title: project.title,
        description: project.description,
        projectType: project.projectType,
        duration: project.duration,
        ownerId: project.ownerId,
        owner: { name: project.owner.name, image: project.owner.image },
        roles: project.roles,
      },
      gapAnalysis,
      { limit: 12, minScore: 0.35 }
    );

    return NextResponse.json({
      gapAnalysis,
      recommendations,
      isOwner,
    });
  } catch (err: any) {
    console.error("GET /api/projects/[id]/gaps failed:", err);
    return NextResponse.json(
      { error: "Failed to perform skill-gap analysis", details: err?.message },
      { status: 500 }
    );
  }
}
