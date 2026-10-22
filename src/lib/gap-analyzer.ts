/**
 * PROJECTMATCH — TEAM SKILL-GAP ANALYZER & EXPLAINABLE MATCHMAKING ENGINE
 *
 * Deterministic, requirement-driven analysis evaluating:
 * - Explicit project needs (Required vs. Preferred capabilities)
 * - Current team composition and coverage states (COVERED, PARTIALLY_COVERED, MISSING, UNKNOWN)
 * - Evidence separation (Self-reported claims vs. Independently supported peer reputation/history)
 * - Capacity & domain concentration risks
 * - Complementary candidate recommendations with transparent, evidence-based explanations
 */

import { tagMatches, normalizeTag } from "./filters/normalize";
import {
  computeCompatibility,
  UserProfile,
  RoleWithProject,
} from "./matching";

// ── Types & Enums ─────────────────────────────────────────────────────────────

export type CapabilityStatus = "COVERED" | "PARTIALLY_COVERED" | "MISSING" | "UNKNOWN";

export type CapabilityImportance = "REQUIRED" | "PREFERRED";

export type RedundancyLevel = "NO_REDUNDANCY" | "HEALTHY_REDUNDANCY" | "HIGH_CONCENTRATION";

export type MatchClassification =
  | "STRONG_COMPLEMENT"
  | "MODERATE_COMPLEMENT"
  | "REDUNDANT"
  | "POTENTIAL_FIT"
  | "INSUFFICIENT_DATA";

export interface ProjectCapabilityItem {
  id: string;
  name: string;
  category?: string | null;
  importance: CapabilityImportance;
  requiredSkills: string[];
  minExperienceLevel?: string | null;
  targetRoleTitle?: string | null;
  description?: string | null;
  isCustom?: boolean;
}

export interface TeamMemberInfo {
  id: string;
  name: string | null;
  image?: string | null;
  roleTitle: string;
  roleId?: string | null;
  isOwner: boolean;
  skills: string[];
  experienceLevel: string | null;
  reputationScore: number;
  availability?: string | null;
  hasSchedule?: boolean;
  weeklyHours?: number | null;
  endorsedSkills?: string[];
  previousProjectTechs?: string[];
}

export interface MemberCoverageContribution {
  memberId: string;
  memberName: string | null;
  roleTitle: string;
  matchedSkills: string[];
  coverageRatio: number;
  experienceLevel: string | null;
  meetsExperience: boolean;
  isStretched: boolean;
}

export interface CapabilityCoverageReport {
  id: string;
  name: string;
  category?: string | null;
  importance: CapabilityImportance;
  status: CapabilityStatus;
  requiredSkills: string[];
  minExperienceLevel?: string | null;
  targetRoleTitle?: string | null;
  matchingMembers: MemberCoverageContribution[];
  missingSkills: string[];
  coveredSkills: string[];
  evidence: {
    selfReported: string[];
    independentlySupported: string[];
    reasons: string[];
  };
  capacityWarning?: string | null;
  associatedOpenRole?: {
    id: string;
    title: string;
    headcount: number;
    filledCount: number;
  } | null;
}

export interface RedundancyAnalysis {
  level: RedundancyLevel;
  duplicatedSkills: Array<{
    skill: string;
    memberCount: number;
    memberNames: string[];
  }>;
  explanation: string;
}

export interface RecruitmentPriority {
  priority: number;
  capabilityId: string;
  capabilityName: string;
  importance: CapabilityImportance;
  status: CapabilityStatus;
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  rationale: string;
  suggestedAction: string;
  roleId?: string | null;
  roleTitle?: string | null;
}

export interface TeamGapAnalysisResult {
  projectId: string;
  projectTitle: string;
  totalRequirements: number;
  coveredCount: number;
  partiallyCoveredCount: number;
  missingCount: number;
  unknownCount: number;
  requiredGapsCount: number;
  preferredGapsCount: number;
  capabilities: CapabilityCoverageReport[];
  redundancy: RedundancyAnalysis;
  recruitmentPriorities: RecruitmentPriority[];
  teamMembers: TeamMemberInfo[];
  openPositions: Array<{
    id: string;
    title: string;
    headcount: number;
    filledCount: number;
    spotsRemaining: number;
    requiredSkills: string[];
    requiredExperienceLevel: string;
    timeCommitment: string;
  }>;
  profileCompleteness: {
    membersWithSkills: number;
    membersTotal: number;
    hasIncompleteProfiles: boolean;
    recommendations: string[];
  };
}

export interface CandidateMatchExplanation {
  roleId: string;
  roleTitle: string;
  baseScore: number;
  finalScore: number;
  complementBonus: number;
  classification: MatchClassification;
  gapsCovered: string[];
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  redundantSkills: string[];
  evidence: {
    verifiedFacts: string[];
    selfReported: string[];
    inferredCompatibility: string[];
    unmetCriteria: string[];
  };
  summaryReason: string;
}

export interface ComplementaryCandidateRecommendation {
  user: {
    id: string;
    name: string | null;
    image?: string | null;
    skills: string[];
    experienceLevel: string | null;
    reputationScore: number;
    availability: string | null;
    hasSchedule: boolean;
  };
  bestRoleMatch: {
    roleId: string;
    roleTitle: string;
    score: number;
  };
  explanation: CandidateMatchExplanation;
}

// ── Experience Mapping Helper ────────────────────────────────────────────────

const EXPERIENCE_RANK: Record<string, number> = {
  beginner: 1,
  junior: 1,
  intermediate: 2,
  "mid-level": 2,
  mid: 2,
  advanced: 3,
  senior: 3,
  expert: 4,
  lead: 4,
  any: 0,
};

export function getExperienceRank(exp: string | null | undefined): number {
  if (!exp) return 0;
  return EXPERIENCE_RANK[exp.toLowerCase().trim()] ?? 1;
}

export function isExperienceSufficient(
  candidateExp: string | null | undefined,
  requiredExp: string | null | undefined
): boolean {
  if (!requiredExp || requiredExp.toLowerCase().trim() === "any") return true;
  if (!candidateExp) return false;
  return getExperienceRank(candidateExp) >= getExperienceRank(requiredExp);
}

// ── Automatic Requirement Derivation ─────────────────────────────────────────

/**
 * Normalizes role title into a clean capability category / name
 */
export function deriveCapabilityNameFromRole(roleTitle: string): string {
  const t = roleTitle.trim();
  const lower = t.toLowerCase();

  if (lower.includes("frontend") || lower.includes("ui engineer") || lower.includes("react")) {
    return "Frontend Development";
  }
  if (lower.includes("backend") || lower.includes("api") || lower.includes("server")) {
    return "Backend Development";
  }
  if (lower.includes("ai") || lower.includes("ml") || lower.includes("machine learning") || lower.includes("data science")) {
    return "AI/ML Integration";
  }
  if (lower.includes("design") || lower.includes("ui/ux") || lower.includes("product design")) {
    return "UI/UX Design";
  }
  if (lower.includes("devops") || lower.includes("infra") || lower.includes("cloud") || lower.includes("deployment")) {
    return "Deployment & Infrastructure";
  }
  if (lower.includes("database") || lower.includes("data engineer") || lower.includes("sql")) {
    return "Database Design";
  }
  if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android") || lower.includes("flutter")) {
    return "Mobile Development";
  }
  if (lower.includes("full") && lower.includes("stack")) {
    return "Full-Stack Development";
  }

  return t;
}

/**
 * Synthesizes default capability requirements from a project's roles and tech stack
 * when the project owner has not defined explicit custom requirements.
 */
export function deriveRequirementsFromRolesAndTech(
  roles: Array<{
    id: string;
    title: string;
    requiredSkills: string[];
    requiredExperienceLevel: string;
  }>,
  techStack: string[] = []
): ProjectCapabilityItem[] {
  const items: ProjectCapabilityItem[] = [];
  const seenNames = new Set<string>();

  for (const role of roles) {
    const capName = deriveCapabilityNameFromRole(role.title);
    if (!seenNames.has(capName.toLowerCase())) {
      seenNames.add(capName.toLowerCase());
      items.push({
        id: `derived-role-${role.id}`,
        name: capName,
        importance: "REQUIRED",
        requiredSkills: role.requiredSkills.length > 0 ? role.requiredSkills : [],
        minExperienceLevel: role.requiredExperienceLevel !== "Any" ? role.requiredExperienceLevel : null,
        targetRoleTitle: role.title,
        description: `Derived from open/defined role: ${role.title}`,
        isCustom: false,
      });
    }
  }

  // If there are tech stack entries not covered by any role, group them as Core Technology Stack
  if (techStack.length > 0 && items.length === 0) {
    items.push({
      id: "derived-techstack",
      name: "Core Technology Stack",
      importance: "REQUIRED",
      requiredSkills: techStack,
      minExperienceLevel: "Intermediate",
      targetRoleTitle: "Core Developer",
      description: "Derived from project technology stack tags",
      isCustom: false,
    });
  }

  return items;
}

// ── Capability Coverage Evaluation ───────────────────────────────────────────

/**
 * Evaluates a single project capability requirement against the team's composition.
 */
export function evaluateCapabilityRequirement(
  capability: ProjectCapabilityItem,
  teamMembers: TeamMemberInfo[],
  memberDomainCounts: Map<string, number>,
  associatedOpenRole?: { id: string; title: string; headcount: number; filledCount: number } | null
): CapabilityCoverageReport {
  const reqSkills = capability.requiredSkills || [];

  // Check data sufficiency:
  // If no skills are defined in the requirement, coverage cannot be determined
  if (reqSkills.length === 0) {
    return {
      id: capability.id,
      name: capability.name,
      category: capability.category,
      importance: capability.importance,
      status: "UNKNOWN",
      requiredSkills: [],
      minExperienceLevel: capability.minExperienceLevel,
      targetRoleTitle: capability.targetRoleTitle,
      matchingMembers: [],
      missingSkills: [],
      coveredSkills: [],
      evidence: {
        selfReported: [],
        independentlySupported: [],
        reasons: [
          `Capability "${capability.name}" has no declared required skills or criteria. Status is unknown until criteria are defined.`,
        ],
      },
      capacityWarning: null,
      associatedOpenRole,
    };
  }

  // Check if all team members have empty profiles (no skills declared)
  const allMembersEmpty = teamMembers.length === 0 || teamMembers.every(
    (m) =>
      (!m.skills || m.skills.length === 0) &&
      (!m.previousProjectTechs || m.previousProjectTechs.length === 0) &&
      (!m.endorsedSkills || m.endorsedSkills.length === 0)
  );

  if (allMembersEmpty) {
    return {
      id: capability.id,
      name: capability.name,
      category: capability.category,
      importance: capability.importance,
      status: "UNKNOWN",
      requiredSkills: reqSkills,
      minExperienceLevel: capability.minExperienceLevel,
      targetRoleTitle: capability.targetRoleTitle,
      matchingMembers: [],
      missingSkills: reqSkills,
      coveredSkills: [],
      evidence: {
        selfReported: [],
        independentlySupported: [],
        reasons: [
          "Current team members have not populated skills in their profile. Coverage cannot be determined from available evidence.",
        ],
      },
      capacityWarning: null,
      associatedOpenRole,
    };
  }

  // Match skills against team members
  const matchingMembers: MemberCoverageContribution[] = [];
  const coveredSkillsSet = new Set<string>();

  for (const member of teamMembers) {
    const memberSkills = member.skills || [];
    const matchedForMember: string[] = [];

    for (const reqSkill of reqSkills) {
      const hasSkill = memberSkills.some((s) => tagMatches(s, reqSkill));
      if (hasSkill) {
        matchedForMember.push(reqSkill);
        coveredSkillsSet.add(reqSkill);
      }
    }

    if (matchedForMember.length > 0) {
      const coverageRatio = matchedForMember.length / reqSkills.length;
      const meetsExp = isExperienceSufficient(member.experienceLevel, capability.minExperienceLevel);
      const isStretched = (memberDomainCounts.get(member.id) ?? 0) >= 3;

      matchingMembers.push({
        memberId: member.id,
        memberName: member.name,
        roleTitle: member.roleTitle,
        matchedSkills: matchedForMember,
        coverageRatio,
        experienceLevel: member.experienceLevel,
        meetsExperience: meetsExp,
        isStretched,
      });
    }
  }

  const coveredSkills = Array.from(coveredSkillsSet);
  const missingSkills = reqSkills.filter((s) => !coveredSkillsSet.has(s));
  const teamCoverageRatio = coveredSkills.length / reqSkills.length;

  // Determine coverage status
  let status: CapabilityStatus;
  const selfReportedEvidence: string[] = [];
  const independentlySupportedEvidence: string[] = [];
  const reasons: string[] = [];

  // Check if at least one member meets the experience requirement
  const anyMeetsExp = matchingMembers.some((m) => m.meetsExperience);

  if (teamCoverageRatio === 0) {
    status = "MISSING";
    reasons.push(
      `No current team member has declared skills matching "${capability.name}" (${reqSkills.join(", ")}).`
    );
  } else if (teamCoverageRatio >= 0.75 && anyMeetsExp) {
    status = "COVERED";
    const primary = matchingMembers[0];
    reasons.push(
      `Covered by ${primary.memberName || "teammate"} (${primary.roleTitle}), covering ${coveredSkills.length} of ${reqSkills.length} required skills with sufficient experience.`
    );
  } else {
    status = "PARTIALLY_COVERED";
    if (teamCoverageRatio < 0.75) {
      reasons.push(
        `Team covers ${coveredSkills.length} of ${reqSkills.length} required skills (${Math.round(teamCoverageRatio * 100)}%), but lacks: ${missingSkills.join(", ")}.`
      );
    } else if (!anyMeetsExp) {
      reasons.push(
        `Team has matching skills (${coveredSkills.join(", ")}), but no contributing member meets the minimum experience requirement (${capability.minExperienceLevel || "specified level"}).`
      );
    }
  }

  // Populate evidence streams
  for (const m of matchingMembers) {
    selfReportedEvidence.push(
      `${m.memberName || "Member"} declared: ${m.matchedSkills.join(", ")} (Level: ${m.experienceLevel || "Unspecified"})`
    );

    const fullMember = teamMembers.find((t) => t.id === m.memberId);
    if (fullMember) {
      if (fullMember.reputationScore > 0) {
        independentlySupportedEvidence.push(
          `${fullMember.name || "Member"} has a verified peer reputation score of ${Math.round(fullMember.reputationScore)}/100`
        );
      }
      if (fullMember.endorsedSkills && fullMember.endorsedSkills.length > 0) {
        const matchingEndorsements = fullMember.endorsedSkills.filter((e) =>
          reqSkills.some((r) => tagMatches(e, r))
        );
        if (matchingEndorsements.length > 0) {
          independentlySupportedEvidence.push(
            `${fullMember.name || "Member"} has peer endorsements in past projects for: ${matchingEndorsements.join(", ")}`
          );
        }
      }
      if (fullMember.previousProjectTechs && fullMember.previousProjectTechs.length > 0) {
        const matchingPastTechs = fullMember.previousProjectTechs.filter((p) =>
          reqSkills.some((r) => tagMatches(p, r))
        );
        if (matchingPastTechs.length > 0) {
          independentlySupportedEvidence.push(
            `${fullMember.name || "Member"} demonstrated ${matchingPastTechs.join(", ")} in verified portfolio projects`
          );
        }
      }
    }
  }

  // Capacity strain check
  let capacityWarning: string | null = null;
  const stretchedMembers = matchingMembers.filter((m) => m.isStretched);
  if (stretchedMembers.length > 0 && matchingMembers.length === stretchedMembers.length) {
    capacityWarning = `${stretchedMembers.map((m) => m.memberName || "Member").join(", ")} is currently the sole contributor across 3+ demanding domains; consider dedicated recruitment to reduce bottleneck risk.`;
  }

  return {
    id: capability.id,
    name: capability.name,
    category: capability.category,
    importance: capability.importance,
    status,
    requiredSkills: reqSkills,
    minExperienceLevel: capability.minExperienceLevel,
    targetRoleTitle: capability.targetRoleTitle,
    matchingMembers,
    missingSkills,
    coveredSkills,
    evidence: {
      selfReported: selfReportedEvidence,
      independentlySupported: independentlySupportedEvidence,
      reasons,
    },
    capacityWarning,
    associatedOpenRole,
  };
}

// ── Redundancy & Concentration Analysis ──────────────────────────────────────

/**
 * Analyzes team skill overlaps to differentiate between healthy redundancy and
 * over-concentration of skills.
 */
export function analyzeSkillRedundancy(
  teamMembers: TeamMemberInfo[],
  missingCapabilities: CapabilityCoverageReport[]
): RedundancyAnalysis {
  if (teamMembers.length <= 1) {
    return {
      level: "NO_REDUNDANCY",
      duplicatedSkills: [],
      explanation: "Single member team; no skill redundancy.",
    };
  }

  // Count occurrences of each skill across distinct members
  const skillMemberMap = new Map<string, Set<string>>();

  for (const member of teamMembers) {
    for (const skill of member.skills || []) {
      const norm = normalizeTag(skill);
      if (!skillMemberMap.has(norm)) {
        skillMemberMap.set(norm, new Set());
      }
      skillMemberMap.get(norm)!.add(member.name || member.id);
    }
  }

  const duplicatedSkills: Array<{
    skill: string;
    memberCount: number;
    memberNames: string[];
  }> = [];

  for (const [skill, membersSet] of skillMemberMap.entries()) {
    if (membersSet.size >= 2) {
      duplicatedSkills.push({
        skill,
        memberCount: membersSet.size,
        memberNames: Array.from(membersSet),
      });
    }
  }

  duplicatedSkills.sort((a, b) => b.memberCount - a.memberCount);

  if (duplicatedSkills.length === 0) {
    return {
      level: "NO_REDUNDANCY",
      duplicatedSkills: [],
      explanation: "Team members bring distinct, non-overlapping skill sets.",
    };
  }

  // Check if team has critical missing capabilities alongside heavy duplication
  const hasCriticalGaps = missingCapabilities.some((c) => c.importance === "REQUIRED");

  if (hasCriticalGaps && duplicatedSkills.some((d) => d.memberCount >= 3)) {
    return {
      level: "HIGH_CONCENTRATION",
      duplicatedSkills,
      explanation: `Heavy skill concentration detected in ${duplicatedSkills[0].skill} (${duplicatedSkills[0].memberCount} members) while critical project capabilities remain missing. Prioritize recruitment outside these duplicated areas.`,
    };
  }

  return {
    level: "HEALTHY_REDUNDANCY",
    duplicatedSkills,
    explanation: `Healthy skill overlap in ${duplicatedSkills.map((d) => `${d.skill} (${d.memberCount})`).slice(0, 3).join(", ")}. Provides collaboration resilience and parallel velocity without harmful overconcentration.`,
  };
}

// ── Recruitment Priorities Ranking ──────────────────────────────────────────

/**
 * Generates an ordered, actionable list of recruitment priorities based on
 * capability gap severity, importance, and open role availability.
 */
export function determineRecruitmentPriorities(
  capabilities: CapabilityCoverageReport[],
  openPositions: Array<{ id: string; title: string; headcount: number; filledCount: number }>
): RecruitmentPriority[] {
  const priorities: RecruitmentPriority[] = [];

  // Group capabilities by urgency
  // 1. Missing REQUIRED capabilities with an open role
  // 2. Partially covered REQUIRED capabilities with an open role
  // 3. Missing REQUIRED capabilities with NO open role (need to create a role)
  // 4. Missing PREFERRED capabilities with an open role
  // 5. Partially covered PREFERRED capabilities

  const scoredCaps = capabilities.map((cap) => {
    const openRole = openPositions.find((r) => {
      if (cap.associatedOpenRole && cap.associatedOpenRole.id === r.id) return true;
      const normRoleTitle = r.title.toLowerCase();
      const normCapName = cap.name.toLowerCase();
      return (
        normRoleTitle.includes(normCapName) ||
        normCapName.includes(normRoleTitle) ||
        (cap.targetRoleTitle && normRoleTitle.includes(cap.targetRoleTitle.toLowerCase()))
      );
    });

    let urgencyScore = 0;
    let urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
    let rationale = "";
    let suggestedAction = "";

    if (cap.status === "MISSING" && cap.importance === "REQUIRED") {
      urgencyScore = openRole ? 100 : 90;
      urgency = "CRITICAL";
      rationale = `Missing required capability: "${cap.name}". No current member covers (${cap.requiredSkills.join(", ")}).`;
      suggestedAction = openRole
        ? `Recruit actively for open role: "${openRole.title}". Prioritize candidates with ${cap.requiredSkills.join(", ")}.`
        : `Consider creating an open role for "${cap.name}" to cover required skills: ${cap.requiredSkills.join(", ")}.`;
    } else if (cap.status === "PARTIALLY_COVERED" && cap.importance === "REQUIRED") {
      urgencyScore = openRole ? 80 : 70;
      urgency = "HIGH";
      rationale = `Partially covered required capability: "${cap.name}". Missing: ${cap.missingSkills.join(", ")}.`;
      suggestedAction = openRole
        ? `Recruit for "${openRole.title}" targeting missing skills: ${cap.missingSkills.join(", ")}.`
        : `Strengthen capability by finding a collaborator skilled in ${cap.missingSkills.join(", ")}.`;
    } else if (cap.status === "MISSING" && cap.importance === "PREFERRED") {
      urgencyScore = openRole ? 60 : 50;
      urgency = "MEDIUM";
      rationale = `Missing preferred capability: "${cap.name}". Would provide competitive advantage.`;
      suggestedAction = openRole
        ? `Recruit candidate for "${openRole.title}" who also brings ${cap.requiredSkills.join(", ")}.`
        : `Optionally open a role or invite a specialist in ${cap.requiredSkills.join(", ")}.`;
    } else if (cap.status === "PARTIALLY_COVERED" && cap.importance === "PREFERRED") {
      urgencyScore = 40;
      urgency = "LOW";
      rationale = `Preferred capability "${cap.name}" is partially covered. Missing: ${cap.missingSkills.join(", ")}.`;
      suggestedAction = `Look for candidates with complementary skills in ${cap.missingSkills.join(", ")} if capacity permits.`;
    } else if (cap.status === "UNKNOWN") {
      urgencyScore = 30;
      urgency = "LOW";
      rationale = `Capability "${cap.name}" has incomplete evidence or missing member profile data.`;
      suggestedAction = `Encourage current team members to complete their profile skills.`;
    } else {
      // COVERED
      urgencyScore = 10;
      urgency = "LOW";
      rationale = `Capability "${cap.name}" is fully covered by existing team members.`;
      suggestedAction = `No urgent recruitment needed for this capability.`;
    }

    return {
      cap,
      openRole,
      urgencyScore,
      urgency,
      rationale,
      suggestedAction,
    };
  });

  // Sort by urgency descending
  scoredCaps.sort((a, b) => b.urgencyScore - a.urgencyScore);

  let priorityCounter = 1;
  for (const item of scoredCaps) {
    if (item.cap.status !== "COVERED") {
      priorities.push({
        priority: priorityCounter++,
        capabilityId: item.cap.id,
        capabilityName: item.cap.name,
        importance: item.cap.importance,
        status: item.cap.status,
        urgency: item.urgency,
        rationale: item.rationale,
        suggestedAction: item.suggestedAction,
        roleId: item.openRole?.id || null,
        roleTitle: item.openRole?.title || null,
      });
    }
  }

  return priorities;
}

// ── Master Team Skill-Gap Analyzer ───────────────────────────────────────────

/**
 * Analyzes team capabilities against explicit and derived project requirements.
 */
export function analyzeTeamSkillGaps(
  project: {
    id: string;
    title: string;
    techStack: string[];
    roles: Array<{
      id: string;
      title: string;
      requiredSkills: string[];
      requiredExperienceLevel: string;
      timeCommitment: string;
      headcount: number;
      filledCount: number;
      isOpen: boolean;
    }>;
  },
  teamMembers: TeamMemberInfo[],
  explicitRequirements: ProjectCapabilityItem[] = []
): TeamGapAnalysisResult {
  // Determine capability requirements:
  // Use explicit requirements if defined; otherwise derive from roles & tech stack
  const requirements =
    explicitRequirements.length > 0
      ? explicitRequirements
      : deriveRequirementsFromRolesAndTech(project.roles, project.techStack);

  // Calculate domain breadths per member to check for capacity stretch
  const memberDomainCounts = new Map<string, number>();
  for (const member of teamMembers) {
    let count = 0;
    for (const req of requirements) {
      const hasSkill = (req.requiredSkills || []).some((r) =>
        (member.skills || []).some((s) => tagMatches(s, r))
      );
      if (hasSkill) count++;
    }
    memberDomainCounts.set(member.id, count);
  }

  // Open positions
  const openPositions = project.roles
    .filter((r) => r.isOpen && r.filledCount < r.headcount)
    .map((r) => ({
      id: r.id,
      title: r.title,
      headcount: r.headcount,
      filledCount: r.filledCount,
      spotsRemaining: r.headcount - r.filledCount,
      requiredSkills: r.requiredSkills,
      requiredExperienceLevel: r.requiredExperienceLevel,
      timeCommitment: r.timeCommitment,
    }));

  // Evaluate each capability
  const capabilities: CapabilityCoverageReport[] = requirements.map((req) => {
    // Check if an open role matches this capability
    const matchingOpenRole = openPositions.find((r) => {
      const normRole = r.title.toLowerCase();
      const normReq = req.name.toLowerCase();
      return (
        normRole.includes(normReq) ||
        normReq.includes(normRole) ||
        (req.targetRoleTitle && normRole.includes(req.targetRoleTitle.toLowerCase()))
      );
    });

    return evaluateCapabilityRequirement(
      req,
      teamMembers,
      memberDomainCounts,
      matchingOpenRole || null
    );
  });

  // Calculate summary counts
  const coveredCount = capabilities.filter((c) => c.status === "COVERED").length;
  const partiallyCoveredCount = capabilities.filter((c) => c.status === "PARTIALLY_COVERED").length;
  const missingCount = capabilities.filter((c) => c.status === "MISSING").length;
  const unknownCount = capabilities.filter((c) => c.status === "UNKNOWN").length;

  const requiredGapsCount = capabilities.filter(
    (c) => c.importance === "REQUIRED" && (c.status === "MISSING" || c.status === "PARTIALLY_COVERED")
  ).length;

  const preferredGapsCount = capabilities.filter(
    (c) => c.importance === "PREFERRED" && (c.status === "MISSING" || c.status === "PARTIALLY_COVERED")
  ).length;

  // Missing capabilities for redundancy checking
  const missingCaps = capabilities.filter((c) => c.status === "MISSING" || c.status === "PARTIALLY_COVERED");

  // Redundancy analysis
  const redundancy = analyzeSkillRedundancy(teamMembers, missingCaps);

  // Recruitment priorities
  const recruitmentPriorities = determineRecruitmentPriorities(capabilities, openPositions);

  // Profile completeness check
  const membersWithSkills = teamMembers.filter((m) => m.skills && m.skills.length > 0).length;
  const hasIncompleteProfiles = membersWithSkills < teamMembers.length;
  const completenessRecs: string[] = [];

  if (hasIncompleteProfiles) {
    const incompleteMembers = teamMembers
      .filter((m) => !m.skills || m.skills.length === 0)
      .map((m) => m.name || "A member");
    completenessRecs.push(
      `${incompleteMembers.join(", ")} has not yet declared technical skills. Updating profiles provides more accurate gap analysis.`
    );
  }

  return {
    projectId: project.id,
    projectTitle: project.title,
    totalRequirements: requirements.length,
    coveredCount,
    partiallyCoveredCount,
    missingCount,
    unknownCount,
    requiredGapsCount,
    preferredGapsCount,
    capabilities,
    redundancy,
    recruitmentPriorities,
    teamMembers,
    openPositions,
    profileCompleteness: {
      membersWithSkills,
      membersTotal: teamMembers.length,
      hasIncompleteProfiles,
      recommendations: completenessRecs,
    },
  };
}

// ── Complementary Candidate Recommendation & Explainability Engine ───────────

export interface CandidateEvaluationContext {
  id: string;
  name: string | null;
  image?: string | null;
  skills: string[];
  experienceLevel: string | null;
  reputationScore?: number | null;
  availabilityHours: number | null;
  availabilityDuration?: string | null;
  scheduleOverlapRatio?: number | null;
  interests?: string[];
  isBanned?: boolean;
  previousProjects?: Array<{ title: string; techStack: string[] }>;
  reviewsReceived?: Array<{ rating: number; skillsEndorsed: string[] }>;
  applications?: Array<{ roleId: string; status: string; projectId: string }>;
}

/**
 * Computes transparent, evidence-based match explanation and complementary ranking
 * for candidates against a project's open roles and skill gaps.
 */
export function evaluateCandidateComplement(
  candidate: CandidateEvaluationContext,
  role: RoleWithProject,
  gapAnalysis: TeamGapAnalysisResult
): CandidateMatchExplanation | null {
  // Hard eligibility checks:
  // 1. Cannot be banned
  if (candidate.isBanned) return null;

  // 2. Cannot be an existing member of the project team
  const isAlreadyMember = gapAnalysis.teamMembers.some((m) => m.id === candidate.id);
  if (isAlreadyMember) return null;

  // 3. Cannot have already been rejected on this project or currently accepted on the project
  const hasRejectedApp = (candidate.applications || []).some(
    (a) => (a.roleId === role.id || a.projectId === role.project.id) && a.status === "REJECTED"
  );
  if (hasRejectedApp) return null;

  const acceptedOnProject = (candidate.applications || []).some(
    (a) => a.projectId === role.project.id && a.status === "ACCEPTED"
  );
  if (acceptedOnProject) return null;

  // 4. Hard requirement check:
  // If the role specifies required skills, and candidate has 0 skills declared, they cannot be recommended
  const candidateSkills = candidate.skills || [];
  const roleRequiredSkills = role.requiredSkills || [];

  const userProfile: UserProfile = {
    id: candidate.id,
    name: candidate.name,
    image: candidate.image,
    skills: candidateSkills,
    interests: candidate.interests || [],
    availabilityHours: candidate.availabilityHours,
    availabilityDuration: candidate.availabilityDuration,
    experienceLevel: candidate.experienceLevel,
    reputationScore: candidate.reputationScore,
    scheduleOverlapRatio: candidate.scheduleOverlapRatio,
  };

  // Base compatibility score from existing matching formula
  const baseResult = computeCompatibility(userProfile, role);
  const baseScore = baseResult.score;

  // Check matching & missing skills for this role
  const matchedRequiredSkills: string[] = [];
  const missingRequiredSkills: string[] = [];

  for (const rSkill of roleRequiredSkills) {
    const hasSkill = candidateSkills.some((s) => tagMatches(s, rSkill));
    if (hasSkill) {
      matchedRequiredSkills.push(rSkill);
    } else {
      missingRequiredSkills.push(rSkill);
    }
  }

  // Complementary gap coverage evaluation:
  // Identify which unmet project capabilities (MISSING or PARTIALLY_COVERED) the candidate covers
  const gapsCovered: string[] = [];
  let complementBonus = 0;

  for (const cap of gapAnalysis.capabilities) {
    if (cap.status === "MISSING" || cap.status === "PARTIALLY_COVERED") {
      const candidateMatchesCap = (cap.requiredSkills || []).filter((r) =>
        candidateSkills.some((s) => tagMatches(s, r))
      );

      if (candidateMatchesCap.length > 0) {
        const meetsExp = isExperienceSufficient(candidate.experienceLevel, cap.minExperienceLevel);
        const matchRatio = candidateMatchesCap.length / (cap.requiredSkills.length || 1);

        if (cap.status === "MISSING" && cap.importance === "REQUIRED") {
          gapsCovered.push(`Fills missing required capability: "${cap.name}" (${candidateMatchesCap.join(", ")})`);
          // Documented weight: up to +0.12 for missing required capability based on coverage ratio
          complementBonus += Math.min(0.12 * matchRatio * (meetsExp ? 1 : 0.8), 0.12);
        } else if (cap.status === "PARTIALLY_COVERED" && cap.importance === "REQUIRED") {
          gapsCovered.push(`Strengthens partially covered capability: "${cap.name}" with ${candidateMatchesCap.join(", ")}`);
          complementBonus += Math.min(0.06 * matchRatio, 0.06);
        } else if (cap.status === "MISSING" && cap.importance === "PREFERRED") {
          gapsCovered.push(`Provides preferred capability: "${cap.name}" (${candidateMatchesCap.join(", ")})`);
          complementBonus += Math.min(0.05 * matchRatio, 0.05);
        }
      }
    }
  }

  // Cap total complement bonus at +0.15 to avoid skewing base algorithmic integrity
  complementBonus = Math.round(Math.min(complementBonus, 0.15) * 1000) / 1000;

  // Check redundant skills: skills candidate has that the team already has abundantly covered
  const redundantSkills: string[] = [];
  for (const cSkill of candidateSkills) {
    const isRedundant = gapAnalysis.redundancy.duplicatedSkills.some(
      (d) => tagMatches(d.skill, cSkill) && d.memberCount >= 2
    );
    if (isRedundant && !matchedRequiredSkills.some((m) => tagMatches(m, cSkill))) {
      redundantSkills.push(cSkill);
    }
  }

  // Calculate final score
  const finalScore = Math.min(1.0, Math.round((baseScore + complementBonus) * 1000) / 1000);

  // Classification determination
  let classification: MatchClassification;
  if (candidateSkills.length === 0) {
    classification = "INSUFFICIENT_DATA";
  } else if (gapsCovered.length > 0 && matchedRequiredSkills.length > 0 && finalScore >= 0.65) {
    classification = "STRONG_COMPLEMENT";
  } else if (gapsCovered.length > 0 && finalScore >= 0.45) {
    classification = "MODERATE_COMPLEMENT";
  } else if (gapsCovered.length === 0 && redundantSkills.length >= 2 && matchedRequiredSkills.length <= 1) {
    classification = "REDUNDANT";
  } else {
    classification = "POTENTIAL_FIT";
  }

  // Build transparent, evidence-based explanation lists
  const verifiedFacts: string[] = [];
  const selfReported: string[] = [];
  const inferredCompatibility: string[] = [];
  const unmetCriteria: string[] = [];

  // Verified facts
  if (candidate.reputationScore && candidate.reputationScore > 0) {
    verifiedFacts.push(
      `Peer reputation score: ${Math.round(candidate.reputationScore)}/100 from community interactions`
    );
  }
  if (candidate.reviewsReceived && candidate.reviewsReceived.length > 0) {
    const avgRating =
      candidate.reviewsReceived.reduce((acc, r) => acc + r.rating, 0) /
      candidate.reviewsReceived.length;
    verifiedFacts.push(
      `Received ${candidate.reviewsReceived.length} peer reviews with an average rating of ${avgRating.toFixed(1)}/5`
    );
    const endorsed = candidate.reviewsReceived.flatMap((r) => r.skillsEndorsed || []);
    const matchingEndorsed = matchedRequiredSkills.filter((s) =>
      endorsed.some((e) => tagMatches(e, s))
    );
    if (matchingEndorsed.length > 0) {
      verifiedFacts.push(`Peer-endorsed for required skills: ${matchingEndorsed.join(", ")}`);
    }
  }
  if (candidate.previousProjects && candidate.previousProjects.length > 0) {
    const relevantProjects = candidate.previousProjects.filter((p) =>
      (p.techStack || []).some((t) => roleRequiredSkills.some((r) => tagMatches(r, t)))
    );
    if (relevantProjects.length > 0) {
      verifiedFacts.push(
        `Portfolio projects demonstrating required stack: "${relevantProjects[0].title}"`
      );
    }
  }

  // Self-reported
  if (candidateSkills.length > 0) {
    selfReported.push(`Declared skills: ${candidateSkills.join(", ")}`);
  } else {
    selfReported.push(`Profile has no declared skills.`);
  }
  if (candidate.experienceLevel) {
    selfReported.push(`Self-reported experience level: ${candidate.experienceLevel}`);
  }

  // Inferred compatibility
  if (matchedRequiredSkills.length > 0) {
    inferredCompatibility.push(
      `Matches ${matchedRequiredSkills.length} of ${roleRequiredSkills.length} required skills for ${role.title}: ${matchedRequiredSkills.join(", ")}`
    );
  }
  if (gapsCovered.length > 0) {
    inferredCompatibility.push(...gapsCovered);
  }
  if (candidate.availabilityHours) {
    inferredCompatibility.push(
      `Available ~${candidate.availabilityHours} hrs/week (Role expectation: ${role.timeCommitment})`
    );
  }
  if (candidate.scheduleOverlapRatio !== undefined && candidate.scheduleOverlapRatio !== null) {
    inferredCompatibility.push(
      `Schedule overlap with team: ${Math.round(candidate.scheduleOverlapRatio * 100)}% mutual availability`
    );
  }

  // Unmet criteria
  if (missingRequiredSkills.length > 0) {
    unmetCriteria.push(`Does not declare required skill(s): ${missingRequiredSkills.join(", ")}`);
  }
  if (!isExperienceSufficient(candidate.experienceLevel, role.requiredExperienceLevel)) {
    unmetCriteria.push(
      `Experience level (${candidate.experienceLevel || "Unspecified"}) is below role requirement (${role.requiredExperienceLevel})`
    );
  }

  // Summary reason
  let summaryReason = "";
  if (classification === "STRONG_COMPLEMENT") {
    summaryReason = `Strong complementary candidate for ${role.title}: fills ${gapsCovered.length} unmet project capabilities and matches ${matchedRequiredSkills.length} required skills.`;
  } else if (classification === "MODERATE_COMPLEMENT") {
    summaryReason = `Moderate complement: provides valuable support for ${gapsCovered.length} team gap(s).`;
  } else if (classification === "REDUNDANT") {
    summaryReason = `Candidate possesses skills the team already abundantly covers (${redundantSkills.join(", ")}), without covering remaining open gaps.`;
  } else if (classification === "INSUFFICIENT_DATA") {
    summaryReason = `Profile has incomplete data to verify capability coverage.`;
  } else {
    summaryReason = `General candidate fit for ${role.title} with compatibility score of ${finalScore}.`;
  }

  return {
    roleId: role.id,
    roleTitle: role.title,
    baseScore,
    finalScore,
    complementBonus,
    classification,
    gapsCovered,
    matchedRequiredSkills,
    missingRequiredSkills,
    redundantSkills,
    evidence: {
      verifiedFacts,
      selfReported,
      inferredCompatibility,
      unmetCriteria,
    },
    summaryReason,
  };
}

/**
 * Recommends and ranks complementary candidates across all open roles in a project.
 */
export function recommendComplementaryCandidates(
  candidates: CandidateEvaluationContext[],
  project: {
    id: string;
    title: string;
    description: string;
    projectType: string;
    duration: string;
    interests?: string[];
    ownerId: string;
    owner: { name: string | null; image?: string | null };
    roles: Array<{
      id: string;
      title: string;
      requiredSkills: string[];
      requiredExperienceLevel: string;
      timeCommitment: string;
      headcount: number;
      filledCount: number;
      isOpen: boolean;
    }>;
  },
  gapAnalysis: TeamGapAnalysisResult,
  options: { limit?: number; minScore?: number } = {}
): ComplementaryCandidateRecommendation[] {
  const { limit = 20, minScore = 0.3 } = options;

  const openRoles = project.roles.filter((r) => r.isOpen && r.filledCount < r.headcount);
  if (openRoles.length === 0) return [];

  const recommendations: ComplementaryCandidateRecommendation[] = [];

  for (const candidate of candidates) {
    let bestExplanation: CandidateMatchExplanation | null = null;
    let bestScore = -1;

    for (const openRole of openRoles) {
      const roleWithProject: RoleWithProject = {
        id: openRole.id,
        title: openRole.title,
        requiredSkills: openRole.requiredSkills,
        requiredExperienceLevel: openRole.requiredExperienceLevel,
        timeCommitment: openRole.timeCommitment,
        headcount: openRole.headcount,
        filledCount: openRole.filledCount,
        project: {
          id: project.id,
          title: project.title,
          description: project.description,
          projectType: project.projectType,
          duration: project.duration,
          interests: project.interests,
          ownerId: project.ownerId,
          owner: project.owner,
        },
      };

      const explanation = evaluateCandidateComplement(candidate, roleWithProject, gapAnalysis);
      if (explanation && explanation.finalScore > bestScore) {
        bestScore = explanation.finalScore;
        bestExplanation = explanation;
      }
    }

    if (
      bestExplanation &&
      bestScore >= minScore &&
      bestExplanation.classification !== "INSUFFICIENT_DATA" &&
      bestExplanation.matchedRequiredSkills.length > 0
    ) {
      recommendations.push({
        user: {
          id: candidate.id,
          name: candidate.name,
          image: candidate.image,
          skills: candidate.skills || [],
          experienceLevel: candidate.experienceLevel,
          reputationScore: candidate.reputationScore ?? 0,
          availability: candidate.availabilityHours ? `${candidate.availabilityHours} hrs/week` : null,
          hasSchedule: !!candidate.scheduleOverlapRatio,
        },
        bestRoleMatch: {
          roleId: bestExplanation.roleId,
          roleTitle: bestExplanation.roleTitle,
          score: bestExplanation.finalScore,
        },
        explanation: bestExplanation,
      });
    }
  }

  // Sort by final score descending (complementary bonus included)
  recommendations.sort((a, b) => b.explanation.finalScore - a.explanation.finalScore);

  return recommendations.slice(0, limit);
}
