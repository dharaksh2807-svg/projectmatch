/**
 * ProjectMatch Compatibility Scoring Engine
 *
 * Compatibility score per candidate–role pair:
 *   Score = 0.40 × SkillOverlap
 *         + 0.20 × AvailabilityFit
 *         + 0.15 × InterestAlignment
 *         + 0.15 × ExperienceFit
 *         + 0.10 × ReputationScore
 *
 * All component scores are normalized to [0, 1].
 */

// --- Experience Level Mapping ---
const EXPERIENCE_RANK: Record<string, number> = {
  Beginner: 1,
  Junior: 1,
  Intermediate: 2,
  "Mid-Level": 2,
  Mid: 2,
  Advanced: 3,
  Senior: 3,
  Expert: 4,
  Lead: 4,
  Any: 0, // means no preference
};

// Time commitment mapping: extract approximate weekly hours
const TIME_COMMITMENT_HOURS: Record<string, number> = {
  "2-5 hrs/week": 3.5,
  "5-10 hrs/week": 7.5,
  "10-20 hrs/week": 15,
  "15 hours/week": 15,
  "15 hrs/week": 15,
  "20-30 hrs/week": 25,
  "Full-time": 40,
};

function parseTimeCommitmentHours(commitment?: string | null): number {
  if (!commitment) return 7.5;
  if (TIME_COMMITMENT_HOURS[commitment]) return TIME_COMMITMENT_HOURS[commitment];
  const num = parseFloat(commitment);
  if (!isNaN(num) && num > 0) return num;
  const match = commitment.match(/(\d+(\.\d+)?)/);
  if (match) {
    const parsed = parseFloat(match[1]);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 7.5;
}

// Duration mapping: approximate weeks
const DURATION_WEEKS: Record<string, number> = {
  "< 1 week": 0.5,
  "1-4 weeks": 2.5,
  "1-3 months": 8,
  "3-6 months": 19,
  "6+ months": 30,
  "3 months": 13,
  Ongoing: 52,
};

const AVAILABILITY_DURATION_WEEKS: Record<string, number> = {
  "1-2 weeks": 1.5,
  "1 month": 4,
  "3 months": 13,
  "6+ months": 26,
  Ongoing: 52,
};

// --- Component Scorers ---

/**
 * Skill Overlap: weighted Jaccard-like similarity between candidate skills and required skills.
 * Required skills that the candidate has boost the score more than extra skills.
 */
export function scoreSkillOverlap(
  candidateSkills: string[] | null | undefined,
  requiredSkills: string[] | null | undefined
): number {
  if (!requiredSkills || requiredSkills.length === 0) return 0.5; // no requirement = neutral
  if (!candidateSkills || candidateSkills.length === 0) return 0;

  const cleanCandidate = candidateSkills.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
  const cleanRequired = requiredSkills.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );

  if (cleanRequired.length === 0) return 0.5;
  if (cleanCandidate.length === 0) return 0;

  const candidateSet = new Set(cleanCandidate.map((s) => s.toLowerCase().trim()));
  const requiredSet = new Set(cleanRequired.map((s) => s.toLowerCase().trim()));

  if (requiredSet.size === 0) return 0.5;
  if (candidateSet.size === 0) return 0;

  let matches = 0;
  for (const skill of requiredSet) {
    if (candidateSet.has(skill)) matches++;
  }

  // Core score: fraction of required skills the candidate has (precision)
  const coverage = matches / requiredSet.size;

  // Small bonus for extra relevant skills (up to 0.1)
  const denominator = candidateSet.size + requiredSet.size + 1;
  const extraBonus =
    denominator > 0
      ? Math.min(Math.max(0, candidateSet.size - matches) / denominator, 0.1)
      : 0;

  const total = Math.min(coverage + extraBonus, 1);
  return isNaN(total) ? 0 : Math.max(0, total);
}

/**
 * Availability Fit: how well the candidate's weekly hours and duration match the role.
 * Penalises over-commitment mismatches and duration mismatches.
 */
export function scoreAvailabilityFit(
  candidateHours: number | null | undefined,
  candidateDuration: string | null | undefined,
  roleTimeCommitment: string,
  projectDuration: string,
  scheduleOverlapRatio?: number | null
): number {
  if (
    candidateHours === null ||
    candidateHours === undefined ||
    isNaN(candidateHours) ||
    candidateHours <= 0
  ) {
    return 0.3; // incomplete profile → below neutral
  }

  const rawHours = parseTimeCommitmentHours(roleTimeCommitment);
  const requiredHours = rawHours > 0 ? rawHours : 7.5;
  const rawWeeks = DURATION_WEEKS[projectDuration] ?? 8;
  const requiredWeeks = rawWeeks > 0 ? rawWeeks : 8;
  const candidateWeeks = candidateDuration
    ? AVAILABILITY_DURATION_WEEKS[candidateDuration] ?? 4
    : 4;

  // Hours fit: score 1 if candidate has ≥ required, decays if they have less
  const hoursDiff = candidateHours - requiredHours;
  let hourScore: number;
  if (hoursDiff >= 0) {
    // They have enough time; slight penalty if they have WAY more (may not prioritize)
    hourScore = hoursDiff > requiredHours ? 0.8 : 1.0;
  } else {
    // They have less time — score linearly from 0 to 1
    hourScore = Math.max(0, 1 + hoursDiff / requiredHours);
  }
  if (isNaN(hourScore)) hourScore = 0.5;

  // Duration fit: score 1 if candidate duration ≥ required, decays otherwise
  const durationDiff = candidateWeeks - requiredWeeks;
  const durationScore =
    durationDiff >= 0
      ? Math.min(1, 1 - (durationDiff / (requiredWeeks * 2 + 1)) * 0.15) // small penalty for much longer
      : Math.max(0, 1 + durationDiff / requiredWeeks);
  const safeDurationScore = isNaN(durationScore) ? 0.5 : durationScore;

  // Baseline commitment score: hours 60%, duration 40%
  const baselineFit = 0.6 * hourScore + 0.4 * safeDurationScore;
  const safeBaselineFit = isNaN(baselineFit) ? 0.3 : Math.max(0, Math.min(1, baselineFit));

  // When concrete schedule overlap is known, blend baseline with actual working hours overlap.
  // Missing schedules (null/undefined) produce the neutral baseline without penalty or arbitrary assumption.
  if (
    scheduleOverlapRatio !== undefined &&
    scheduleOverlapRatio !== null &&
    !isNaN(scheduleOverlapRatio)
  ) {
    const clampedOverlap = Math.max(0, Math.min(1, scheduleOverlapRatio));
    return Math.round((0.6 * safeBaselineFit + 0.4 * clampedOverlap) * 1000) / 1000;
  }

  return safeBaselineFit;
}

/**
 * Interest Alignment: Jaccard similarity between candidate interests and project domain tags.
 * The project doesn't have explicit interest tags — we infer from project type + role skills.
 */
export function scoreInterestAlignment(
  candidateInterests: string[] | null | undefined,
  projectInterestTags: string[] | null | undefined
): number {
  if (
    !projectInterestTags ||
    projectInterestTags.length === 0 ||
    !candidateInterests ||
    candidateInterests.length === 0
  ) {
    return 0.3;
  }

  const cleanCandidate = candidateInterests.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
  const cleanTags = projectInterestTags.filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
  if (cleanCandidate.length === 0 || cleanTags.length === 0) return 0.3;

  const aSet = new Set(cleanCandidate.map((s) => s.toLowerCase().trim()));
  const bSet = new Set(cleanTags.map((s) => s.toLowerCase().trim()));

  let intersection = 0;
  for (const tag of bSet) {
    if (aSet.has(tag)) intersection++;
  }

  const union = new Set([...aSet, ...bSet]).size;
  if (union === 0) return 0.3;
  const result = intersection / union;
  return isNaN(result) ? 0.3 : Math.max(0, Math.min(1, result));
}

/**
 * Experience Fit: penalises both under- and wildly over-qualified candidates.
 * Uses a Gaussian-like score centred on the required level.
 */
export function scoreExperienceFit(
  candidateLevel: string | null | undefined,
  requiredLevel: string | null | undefined
): number {
  if (!candidateLevel || typeof candidateLevel !== "string" || !candidateLevel.trim()) {
    return 0.3;
  }
  const cleanReq = (requiredLevel || "Any").trim();
  if (cleanReq === "Any" || cleanReq.toLowerCase() === "any") return 0.75; // any level accepted — slightly above neutral

  const candidateRank = EXPERIENCE_RANK[candidateLevel.trim()] ?? 2;
  const requiredRank = EXPERIENCE_RANK[cleanReq] ?? 2;

  const diff = Math.abs(candidateRank - requiredRank);

  // diff=0 → 1.0, diff=1 → 0.7, diff=2 → 0.4, diff=3 → 0.1
  const result = Math.max(0, 1 - diff * 0.3);
  return isNaN(result) ? 0.3 : result;
}

/**
 * Reputation Score: normalize the 0–100 rating scale to 0–1.
 * New users with 50 (neutral default) map to 0.5 — no penalty for fresh accounts.
 * Users with no ratings (null/undefined/0) also default to neutral 0.5.
 */
export function scoreReputation(reputationScore: number | null | undefined): number {
  if (
    reputationScore === null ||
    reputationScore === undefined ||
    isNaN(reputationScore)
  ) {
    return 0.5; // neutral for new users
  }
  // Legacy: scores ≤ 5 were on the old 0–5 scale → convert up
  if (reputationScore <= 5) {
    return reputationScore <= 0 ? 0.5 : Math.min(reputationScore / 5, 1);
  }
  // New 0–100 scale
  const norm = Math.min(Math.max(0, reputationScore / 100), 1);
  return isNaN(norm) ? 0.5 : norm;
}

/**
 * Checks whether a user profile has all core fields populated for matching:
 * - non-empty skills array
 * - non-empty experience level
 * - non-empty availability (hours or duration)
 */
export function isUserProfileComplete(
  user: Partial<UserProfile> | null | undefined
): boolean {
  if (!user) return false;

  const hasSkills =
    Array.isArray(user.skills) &&
    user.skills.filter((s) => s && typeof s === "string" && s.trim().length > 0).length > 0;

  const hasExperience =
    typeof user.experienceLevel === "string" && user.experienceLevel.trim().length > 0;

  const hasAvailabilityHours =
    typeof user.availabilityHours === "number" &&
    !isNaN(user.availabilityHours) &&
    user.availabilityHours > 0;

  const hasAvailabilityDuration =
    typeof user.availabilityDuration === "string" &&
    user.availabilityDuration.trim().length > 0;

  return Boolean(hasSkills && hasExperience && (hasAvailabilityHours || hasAvailabilityDuration));
}

// --- Types ---

export interface UserProfile {
  id: string;
  name: string | null;
  image?: string | null;
  skills: string[];
  interests: string[];
  availabilityHours: number | null;
  availabilityDuration?: string | null;
  experienceLevel: string | null;
  reputationScore?: number | null;
  portfolioLinks?: string[];
  scheduleOverlapRatio?: number | null;
}

export interface RoleWithProject {
  id: string;
  title: string;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  project: {
    id: string;
    title: string;
    description: string;
    projectType: string;
    duration: string;
    interests?: string[];
    ownerId: string;
    owner: {
      name: string | null;
      image?: string | null;
    };
  };
}

export interface CompatibilityResult {
  score: number; // 0–1 total score
  isProfileComplete?: boolean;
  breakdown: {
    skillOverlap: number;
    availabilityFit: number;
    interestAlignment: number;
    experienceFit: number;
    reputationScore: number;
  };
}

/**
 * Derive interest tags from a project's type, role skills, and any explicit project interests
 */
function deriveProjectInterestTags(
  projectType: string,
  roleSkills: string[],
  explicitInterests: string[] = []
): string[] {
  const typeTagMap: Record<string, string[]> = {
    Hackathon: ["Hackathon", "Competition", "AI/ML", "Side Project"],
    Startup: ["Startup", "SaaS", "FinTech", "Fintech", "EdTech"],
    Fintech: ["Fintech", "FinTech", "Finance", "SaaS"],
    FinTech: ["Fintech", "FinTech", "Finance", "SaaS"],
    Research: ["Research", "AI/ML", "Data Science", "Biotech"],
    "Open Source": ["Open Source", "Dev Tools", "Productivity"],
    "Side Project": ["Side Project", "Mobile", "Productivity"],
    Competition: ["Competition", "AI/ML", "Game Dev"],
  };

  const typeTags = typeTagMap[projectType] || [projectType];

  // Infer domain from skills
  const skillDomainMap: Record<string, string[]> = {
    "Machine Learning": ["AI/ML"],
    TensorFlow: ["AI/ML"],
    PyTorch: ["AI/ML"],
    Blockchain: ["Blockchain/Web3"],
    Solidity: ["Blockchain/Web3"],
    Flutter: ["Mobile"],
    "React Native": ["Mobile"],
    Android: ["Mobile"],
    iOS: ["Mobile"],
    Unity: ["Game Dev"],
    "Game Dev": ["Game Dev"],
    "UI/UX Design": ["Design"],
    Figma: ["Design"],
  };

  const skillTags: string[] = [];
  for (const skill of roleSkills) {
    if (skillDomainMap[skill]) skillTags.push(...skillDomainMap[skill]);
  }

  return [...new Set([...typeTags, ...explicitInterests, ...skillTags])];
}

/**
 * Compute the full compatibility score between a user and a role.
 */
export function computeCompatibility(
  user: UserProfile,
  role: RoleWithProject
): CompatibilityResult {
  const isProfileComplete = isUserProfileComplete(user);

  const interestTags = deriveProjectInterestTags(
    role.project.projectType,
    role.requiredSkills,
    role.project.interests || []
  );

  const skillOverlap = scoreSkillOverlap(user.skills, role.requiredSkills);
  const availabilityFit = scoreAvailabilityFit(
    user.availabilityHours,
    user.availabilityDuration || null,
    role.timeCommitment,
    role.project.duration,
    user.scheduleOverlapRatio
  );
  const interestAlignment = scoreInterestAlignment(user.interests, interestTags);
  const experienceFit = scoreExperienceFit(user.experienceLevel, role.requiredExperienceLevel);
  const reputationNorm = scoreReputation(user.reputationScore);

  const rawScore =
    0.40 * skillOverlap +
    0.20 * availabilityFit +
    0.15 * interestAlignment +
    0.15 * experienceFit +
    0.10 * reputationNorm;

  const score = isNaN(rawScore) ? 0 : Math.round(rawScore * 1000) / 1000;

  return {
    score,
    isProfileComplete,
    breakdown: {
      skillOverlap: isNaN(skillOverlap) ? 0 : Math.round(skillOverlap * 100) / 100,
      availabilityFit: isNaN(availabilityFit) ? 0 : Math.round(availabilityFit * 100) / 100,
      interestAlignment: isNaN(interestAlignment) ? 0 : Math.round(interestAlignment * 100) / 100,
      experienceFit: isNaN(experienceFit) ? 0 : Math.round(experienceFit * 100) / 100,
      reputationScore: isNaN(reputationNorm) ? 0 : Math.round(reputationNorm * 100) / 100,
    },
  };
}

/**
 * Rank a list of roles for a given user. Returns only open roles, sorted by score desc.
 */
export function rankRolesForUser(
  user: UserProfile,
  roles: RoleWithProject[],
  options: {
    excludeOwnedBy?: string; // exclude projects owned by this userId
    minScore?: number;
    limit?: number;
  } = {}
): Array<RoleWithProject & { compatibility: CompatibilityResult }> {
  const { excludeOwnedBy, minScore = 0, limit = 50 } = options;

  const open = roles.filter(
    (r) =>
      r.filledCount < r.headcount &&
      (!excludeOwnedBy || r.project.ownerId !== excludeOwnedBy)
  );

  const scored = open
    .map((role) => ({
      ...role,
      compatibility: computeCompatibility(user, role),
    }))
    .filter((r) => r.compatibility.score >= minScore)
    .sort((a, b) => b.compatibility.score - a.compatibility.score);

  return scored.slice(0, limit);
}

/**
 * Rank a list of users for a given role. Returns sorted by score desc.
 */
export function rankUsersForRole(
  users: UserProfile[],
  role: RoleWithProject,
  options: { minScore?: number; limit?: number } = {}
): Array<UserProfile & { compatibility: CompatibilityResult }> {
  const { minScore = 0, limit = 50 } = options;

  return users
    .map((user) => ({
      ...user,
      compatibility: computeCompatibility(user, role),
    }))
    .filter((u) => u.compatibility.score >= minScore)
    .sort((a, b) => b.compatibility.score - a.compatibility.score)
    .slice(0, limit);
}
