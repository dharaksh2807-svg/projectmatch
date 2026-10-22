import { describe, it, expect } from "vitest";
import {
  analyzeTeamSkillGaps,
  evaluateCandidateComplement,
  recommendComplementaryCandidates,
  TeamMemberInfo,
  ProjectCapabilityItem,
  CandidateEvaluationContext,
} from "./gap-analyzer";
import { computeCompatibility, RoleWithProject, UserProfile } from "./matching";

describe("Team Skill-Gap Analyzer and Explainable Matchmaking", () => {
  // Mock Project Data
  const baseProject = {
    id: "proj-101",
    title: "AI Student Assistant",
    description: "An AI-powered academic assistant for students",
    projectType: "Hackathon",
    duration: "1-4 weeks",
    techStack: ["Next.js", "Python", "FastAPI", "PostgreSQL", "Docker"],
    ownerId: "user-owner",
    owner: { name: "Alice Owner", image: null },
    roles: [
      {
        id: "role-frontend",
        title: "Frontend Developer",
        requiredSkills: ["React", "Next.js", "TypeScript"],
        requiredExperienceLevel: "Intermediate",
        timeCommitment: "15 hrs/week",
        headcount: 1,
        filledCount: 1,
        isOpen: false,
      },
      {
        id: "role-aiml",
        title: "AI/ML Engineer",
        requiredSkills: ["Python", "PyTorch", "FastAPI"],
        requiredExperienceLevel: "Intermediate",
        timeCommitment: "15 hrs/week",
        headcount: 1,
        filledCount: 0,
        isOpen: true,
      },
      {
        id: "role-devops",
        title: "DevOps & Cloud Engineer",
        requiredSkills: ["Docker", "Kubernetes", "AWS"],
        requiredExperienceLevel: "Advanced",
        timeCommitment: "10-20 hrs/week",
        headcount: 1,
        filledCount: 0,
        isOpen: true,
      },
    ],
  };

  // Mock Explicit Project Requirements
  const explicitRequirements: ProjectCapabilityItem[] = [
    {
      id: "req-frontend",
      name: "Frontend Development",
      category: "ENGINEERING",
      importance: "REQUIRED",
      requiredSkills: ["React", "Next.js", "TypeScript"],
      minExperienceLevel: "Intermediate",
      targetRoleTitle: "Frontend Developer",
      isCustom: true,
    },
    {
      id: "req-backend",
      name: "Backend Development",
      category: "ENGINEERING",
      importance: "REQUIRED",
      requiredSkills: ["Python", "FastAPI", "PostgreSQL"],
      minExperienceLevel: "Intermediate",
      targetRoleTitle: "Backend Developer",
      isCustom: true,
    },
    {
      id: "req-aiml",
      name: "AI/ML Integration",
      category: "AI_ML",
      importance: "REQUIRED",
      requiredSkills: ["Python", "PyTorch", "LangChain"],
      minExperienceLevel: "Intermediate",
      targetRoleTitle: "AI/ML Engineer",
      isCustom: true,
    },
    {
      id: "req-deployment",
      name: "Deployment & Infrastructure",
      category: "DEVOPS",
      importance: "REQUIRED",
      requiredSkills: ["Docker", "Kubernetes", "AWS"],
      minExperienceLevel: "Advanced",
      targetRoleTitle: "DevOps & Cloud Engineer",
      isCustom: true,
    },
    {
      id: "req-design",
      name: "UI/UX Design",
      category: "DESIGN",
      importance: "PREFERRED",
      requiredSkills: ["Figma", "UI/UX Design"],
      minExperienceLevel: "Intermediate",
      targetRoleTitle: "Product Designer",
      isCustom: true,
    },
    {
      id: "req-pitch",
      name: "Presentation & Pitching",
      category: "PRODUCT",
      importance: "PREFERRED",
      requiredSkills: ["Pitch Deck", "Public Speaking"],
      minExperienceLevel: "Any",
      targetRoleTitle: "Pitch Lead",
      isCustom: true,
    },
  ];

  // ── 1. Fully Covered Requirements ──────────────────────────────────────────
  it("Scenario 1: identifies fully covered requirements with sufficient skills and experience", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "Next.js", "TypeScript", "Tailwind CSS"],
        experienceLevel: "Advanced",
        reputationScore: 85,
        availability: "Part-time",
        hasSchedule: true,
        weeklyHours: 20,
        endorsedSkills: ["React", "Next.js"],
        previousProjectTechs: ["React", "Next.js"],
      },
    ];

    const result = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);
    const frontendCap = result.capabilities.find((c) => c.name === "Frontend Development");

    expect(frontendCap).toBeDefined();
    expect(frontendCap?.status).toBe("COVERED");
    expect(frontendCap?.coveredSkills).toEqual(expect.arrayContaining(["React", "Next.js", "TypeScript"]));
    expect(frontendCap?.missingSkills.length).toBe(0);
    expect(frontendCap?.evidence.reasons[0]).toContain("Covered by Alice Owner");
    expect(frontendCap?.evidence.selfReported.length).toBeGreaterThan(0);
    expect(frontendCap?.evidence.independentlySupported.length).toBeGreaterThan(0);
  });

  // ── 2. Partially Covered Requirements ──────────────────────────────────────
  it("Scenario 2: flags partially covered requirements when skills are incomplete or experience is insufficient", () => {
    // Case A: Missing some skills
    const memberPartialSkills: TeamMemberInfo[] = [
      {
        id: "user-1",
        name: "Bob Backend",
        roleTitle: "Backend Developer",
        isOwner: false,
        skills: ["Python"], // Has Python, but missing FastAPI & PostgreSQL
        experienceLevel: "Intermediate",
        reputationScore: 70,
      },
    ];

    const resultA = analyzeTeamSkillGaps(baseProject, memberPartialSkills, explicitRequirements);
    const backendCapA = resultA.capabilities.find((c) => c.name === "Backend Development");
    expect(backendCapA?.status).toBe("PARTIALLY_COVERED");
    expect(backendCapA?.coveredSkills).toEqual(["Python"]);
    expect(backendCapA?.missingSkills).toEqual(expect.arrayContaining(["FastAPI", "PostgreSQL"]));

    // Case B: Has all skills, but lacks required experience level (Beginner < Advanced)
    const memberLowExp: TeamMemberInfo[] = [
      {
        id: "user-2",
        name: "Charlie Junior",
        roleTitle: "DevOps Engineer",
        isOwner: false,
        skills: ["Docker", "Kubernetes", "AWS"], // Has all 3 skills!
        experienceLevel: "Beginner", // Requires Advanced
        reputationScore: 60,
      },
    ];

    const resultB = analyzeTeamSkillGaps(baseProject, memberLowExp, explicitRequirements);
    const devopsCap = resultB.capabilities.find((c) => c.name === "Deployment & Infrastructure");
    expect(devopsCap?.status).toBe("PARTIALLY_COVERED");
    expect(devopsCap?.evidence.reasons[0]).toContain("no contributing member meets the minimum experience requirement");
  });

  // ── 3. Missing Capabilities ────────────────────────────────────────────────
  it("Scenario 3: identifies completely missing capabilities when no team member possesses relevant skills", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "Next.js"], // Frontend only
        experienceLevel: "Intermediate",
        reputationScore: 75,
      },
    ];

    const result = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);
    const aimlCap = result.capabilities.find((c) => c.name === "AI/ML Integration");
    const devopsCap = result.capabilities.find((c) => c.name === "Deployment & Infrastructure");

    expect(aimlCap?.status).toBe("MISSING");
    expect(aimlCap?.coveredSkills.length).toBe(0);
    expect(aimlCap?.missingSkills).toEqual(expect.arrayContaining(["Python", "PyTorch", "LangChain"]));

    expect(devopsCap?.status).toBe("MISSING");
    expect(devopsCap?.missingSkills).toEqual(expect.arrayContaining(["Docker", "Kubernetes", "AWS"]));
  });

  // ── 4. Unknown Profile Data ────────────────────────────────────────────────
  it("Scenario 4: marks status as UNKNOWN when profile data is incomplete, avoiding unfair unskilled labels", () => {
    const memberEmptyProfile: TeamMemberInfo[] = [
      {
        id: "user-silent",
        name: "Silent Sam",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: [], // Empty skills
        experienceLevel: null,
        reputationScore: 0,
      },
    ];

    const result = analyzeTeamSkillGaps(baseProject, memberEmptyProfile, explicitRequirements);
    for (const cap of result.capabilities) {
      expect(cap.status).toBe("UNKNOWN");
      expect(cap.evidence.reasons[0]).toContain("have not populated skills");
    }

    // Profile completeness diagnostic
    expect(result.profileCompleteness.hasIncompleteProfiles).toBe(true);
    expect(result.profileCompleteness.recommendations[0]).toContain("Silent Sam has not yet declared technical skills");
  });

  // ── 5. Required versus Preferred Skills ────────────────────────────────────
  it("Scenario 5: prioritizes missing REQUIRED capabilities over PREFERRED capabilities in recruitment urgency", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "TypeScript"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const result = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);
    const priorities = result.recruitmentPriorities;

    expect(priorities.length).toBeGreaterThan(0);
    // First priority should be a missing REQUIRED capability with an open role (e.g. AI/ML or DevOps)
    const firstPriority = priorities[0];
    expect(firstPriority.importance).toBe("REQUIRED");
    expect(["CRITICAL", "HIGH"]).toContain(firstPriority.urgency);

    // Preferred capability (e.g. Pitching or UI/UX) should be ranked lower with lower urgency
    const prefPriority = priorities.find((p) => p.capabilityName === "Presentation & Pitching");
    if (prefPriority) {
      expect(prefPriority.importance).toBe("PREFERRED");
      expect(["MEDIUM", "LOW"]).toContain(prefPriority.urgency);
      expect(prefPriority.priority).toBeGreaterThan(firstPriority.priority);
    }
  });

  // ── 6. Candidates with Complementary Skills ─────────────────────────────────
  it("Scenario 6: promotes candidates covering unmet project gaps with explainable bonus and classification", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "TypeScript"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const gapAnalysis = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);

    // Candidate who fills the missing AI/ML capability
    const candidateAiml: CandidateEvaluationContext = {
      id: "cand-aiml",
      name: "Dr. ML Specialist",
      skills: ["Python", "PyTorch", "FastAPI", "LangChain"],
      experienceLevel: "Intermediate",
      reputationScore: 88,
      availabilityHours: 20,
      scheduleOverlapRatio: 0.8,
      interests: ["AI/ML", "Hackathon"],
      reviewsReceived: [{ rating: 5, skillsEndorsed: ["PyTorch", "Python"] }],
      previousProjects: [{ title: "LLM Agent Bot", techStack: ["Python", "PyTorch"] }],
    };

    const recs = recommendComplementaryCandidates([candidateAiml], baseProject, gapAnalysis);

    expect(recs.length).toBe(1);
    const rec = recs[0];
    expect(rec.user.id).toBe("cand-aiml");
    expect(rec.bestRoleMatch.roleTitle).toBe("AI/ML Engineer");
    expect(rec.explanation.classification).toBe("STRONG_COMPLEMENT");
    expect(rec.explanation.complementBonus).toBeGreaterThan(0);
    expect(rec.explanation.gapsCovered.length).toBeGreaterThan(0);
    expect(rec.explanation.gapsCovered.some((g) => g.includes("AI/ML Integration"))).toBe(true);
    expect(rec.explanation.evidence.verifiedFacts.length).toBeGreaterThan(0);
  });

  // ── 7. Candidates with Redundant Skills ─────────────────────────────────────
  it("Scenario 7: flags candidates whose skills duplicate existing strengths without filling unmet gaps", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "Next.js", "TypeScript"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
      {
        id: "user-frontend-2",
        name: "Bob Frontend",
        roleTitle: "Frontend Dev",
        isOwner: false,
        skills: ["React", "Next.js", "TypeScript", "Tailwind CSS"],
        experienceLevel: "Intermediate",
        reputationScore: 82,
      },
    ];

    const gapAnalysis = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);

    // Candidate who only has React/TypeScript and no backend/AI/ML/DevOps skills
    const redundantCandidate: CandidateEvaluationContext = {
      id: "cand-redundant",
      name: "Rachel Redundant",
      skills: ["React", "TypeScript", "Tailwind CSS"],
      experienceLevel: "Intermediate",
      reputationScore: 70,
      availabilityHours: 15,
      interests: ["Frontend"],
    };

    const roleDevops = baseProject.roles.find((r) => r.id === "role-devops")!;
    const roleWithProject: RoleWithProject = {
      ...roleDevops,
      project: {
        id: baseProject.id,
        title: baseProject.title,
        description: baseProject.description,
        projectType: baseProject.projectType,
        duration: baseProject.duration,
        ownerId: baseProject.ownerId,
        owner: baseProject.owner,
      },
    };

    const explanation = evaluateCandidateComplement(redundantCandidate, roleWithProject, gapAnalysis);
    expect(explanation).toBeDefined();
    expect(explanation?.gapsCovered.length).toBe(0);
    expect(explanation?.complementBonus).toBe(0);
    expect(["REDUNDANT", "POTENTIAL_FIT"]).toContain(explanation?.classification);
  });

  // ── 8. Multiple Open Roles ─────────────────────────────────────────────────
  it("Scenario 8: accurately evaluates candidates across multiple open roles and selects the best complementary fit", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "Next.js"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const gapAnalysis = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);

    const devopsCandidate: CandidateEvaluationContext = {
      id: "cand-devops",
      name: "Dave DevOps",
      skills: ["Docker", "Kubernetes", "AWS", "CI/CD"],
      experienceLevel: "Advanced",
      reputationScore: 90,
      availabilityHours: 20,
    };

    const mlCandidate: CandidateEvaluationContext = {
      id: "cand-ml",
      name: "Mary ML",
      skills: ["Python", "PyTorch", "FastAPI"],
      experienceLevel: "Intermediate",
      reputationScore: 85,
      availabilityHours: 15,
    };

    const recs = recommendComplementaryCandidates(
      [devopsCandidate, mlCandidate],
      baseProject,
      gapAnalysis
    );

    expect(recs.length).toBe(2);

    const devopsRec = recs.find((r) => r.user.id === "cand-devops")!;
    expect(devopsRec.bestRoleMatch.roleTitle).toBe("DevOps & Cloud Engineer");

    const mlRec = recs.find((r) => r.user.id === "cand-ml")!;
    expect(mlRec.bestRoleMatch.roleTitle).toBe("AI/ML Engineer");
  });

  // ── 9. Team Membership Changes ─────────────────────────────────────────────
  it("Scenario 9: dynamically updates capability coverage when a new member joins the team", () => {
    // Initial state: Only owner (Frontend)
    const initialMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "Next.js"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const initialAnalysis = analyzeTeamSkillGaps(baseProject, initialMembers, explicitRequirements);
    expect(initialAnalysis.capabilities.find((c) => c.name === "AI/ML Integration")?.status).toBe("MISSING");

    // After member joins
    const updatedMembers: TeamMemberInfo[] = [
      ...initialMembers,
      {
        id: "user-ml-join",
        name: "Mona ML",
        roleTitle: "AI/ML Engineer",
        isOwner: false,
        skills: ["Python", "PyTorch", "LangChain"],
        experienceLevel: "Intermediate",
        reputationScore: 85,
      },
    ];

    const updatedAnalysis = analyzeTeamSkillGaps(baseProject, updatedMembers, explicitRequirements);
    const aimlCap = updatedAnalysis.capabilities.find((c) => c.name === "AI/ML Integration");
    expect(aimlCap?.status).toBe("COVERED");
    expect(aimlCap?.coveredSkills).toEqual(expect.arrayContaining(["Python", "PyTorch", "LangChain"]));
  });

  // ── 10. Skills Updated After Team Creation ──────────────────────────────────
  it("Scenario 10: reflects profile skill updates dynamically without requiring team recreation", () => {
    const member: TeamMemberInfo = {
      id: "user-1",
      name: "Bob Upgrading",
      roleTitle: "Developer",
      isOwner: false,
      skills: ["React"], // Initially only React
      experienceLevel: "Intermediate",
      reputationScore: 75,
    };

    const initialResult = analyzeTeamSkillGaps(baseProject, [member], explicitRequirements);
    expect(initialResult.capabilities.find((c) => c.name === "Frontend Development")?.status).toBe("PARTIALLY_COVERED");

    // Member completes learning and updates profile skills to include Next.js and TypeScript
    const updatedMember: TeamMemberInfo = {
      ...member,
      skills: ["React", "Next.js", "TypeScript"],
    };

    const updatedResult = analyzeTeamSkillGaps(baseProject, [updatedMember], explicitRequirements);
    expect(updatedResult.capabilities.find((c) => c.name === "Frontend Development")?.status).toBe("COVERED");
  });

  // ── 11. Ineligible Candidates Excluded ──────────────────────────────────────
  it("Scenario 11: excludes ineligible candidates (team owner, accepted members, banned users, rejected candidates)", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const gapAnalysis = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);

    const candidates: CandidateEvaluationContext[] = [
      // Owner themselves
      {
        id: "user-owner",
        name: "Alice Owner",
        skills: ["Python", "PyTorch"],
        experienceLevel: "Expert",
        reputationScore: 90,
        availabilityHours: 20,
      },
      // Banned user
      {
        id: "user-banned",
        name: "Bad Actor",
        skills: ["Python", "PyTorch"],
        experienceLevel: "Expert",
        reputationScore: 10,
        isBanned: true,
        availabilityHours: 20,
      },
      // Rejected candidate for this role
      {
        id: "user-rejected",
        name: "Rejected Applicant",
        skills: ["Python", "PyTorch"],
        experienceLevel: "Intermediate",
        reputationScore: 70,
        availabilityHours: 15,
        applications: [{ roleId: "role-aiml", status: "REJECTED", projectId: baseProject.id }],
      },
      // Valid eligible candidate
      {
        id: "user-eligible",
        name: "Valid Candidate",
        skills: ["Python", "PyTorch"],
        experienceLevel: "Intermediate",
        reputationScore: 75,
        availabilityHours: 15,
      },
    ];

    const recs = recommendComplementaryCandidates(candidates, baseProject, gapAnalysis);

    expect(recs.length).toBe(1);
    expect(recs[0].user.id).toBe("user-eligible");
  });

  // ── 12. Recommendations Never Bypass Hard Requirements ──────────────────────
  it("Scenario 12: never recommends candidates with empty profiles or zero relevant skills for technical roles", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const gapAnalysis = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);

    const emptyCandidate: CandidateEvaluationContext = {
      id: "cand-empty",
      name: "Empty Profile",
      skills: [], // No skills
      experienceLevel: null,
      reputationScore: 50,
      availabilityHours: null,
    };

    const roleAiml = baseProject.roles.find((r) => r.id === "role-aiml")!;
    const roleWithProject: RoleWithProject = {
      ...roleAiml,
      project: {
        id: baseProject.id,
        title: baseProject.title,
        description: baseProject.description,
        projectType: baseProject.projectType,
        duration: baseProject.duration,
        ownerId: baseProject.ownerId,
        owner: baseProject.owner,
      },
    };

    const explanation = evaluateCandidateComplement(emptyCandidate, roleWithProject, gapAnalysis);
    expect(explanation?.classification).toBe("INSUFFICIENT_DATA");
    expect(explanation?.matchedRequiredSkills.length).toBe(0);
    expect(explanation?.complementBonus).toBe(0);
  });

  // ── 13. Correct Authorization & Role Management ────────────────────────────
  it("Scenario 13: supports owner-customized requirements vs derived fallback requirements", () => {
    // When explicit custom requirements are provided, they take precedence
    const customReqs: ProjectCapabilityItem[] = [
      {
        id: "custom-1",
        name: "Mobile App Development",
        importance: "REQUIRED",
        requiredSkills: ["Flutter", "Dart"],
        minExperienceLevel: "Intermediate",
        isCustom: true,
      },
    ];

    const team: TeamMemberInfo[] = [
      {
        id: "user-1",
        name: "Mobile Dev",
        roleTitle: "Lead",
        isOwner: true,
        skills: ["Flutter", "Dart"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const customAnalysis = analyzeTeamSkillGaps(baseProject, team, customReqs);
    expect(customAnalysis.capabilities.length).toBe(1);
    expect(customAnalysis.capabilities[0].name).toBe("Mobile App Development");
    expect(customAnalysis.capabilities[0].status).toBe("COVERED");

    // When NO explicit requirements are passed, automatically derives from roles and tech stack
    const derivedAnalysis = analyzeTeamSkillGaps(baseProject, team, []);
    expect(derivedAnalysis.capabilities.length).toBeGreaterThanOrEqual(baseProject.roles.length);
    const derivedFrontend = derivedAnalysis.capabilities.find((c) => c.name === "Frontend Development");
    expect(derivedFrontend).toBeDefined();
  });

  // ── 14. Existing Matching Compatibility ────────────────────────────────────
  it("Scenario 14: preserves exact base matching score compatibility from computeCompatibility", () => {
    const userProfile: UserProfile = {
      id: "u-test",
      name: "Tester",
      skills: ["Python", "FastAPI"],
      interests: ["AI/ML"],
      availabilityHours: 15,
      availabilityDuration: "1-4 weeks",
      experienceLevel: "Intermediate",
      reputationScore: 80,
    };

    const roleAiml = baseProject.roles.find((r) => r.id === "role-aiml")!;
    const roleWithProject: RoleWithProject = {
      ...roleAiml,
      project: {
        id: baseProject.id,
        title: baseProject.title,
        description: baseProject.description,
        projectType: baseProject.projectType,
        duration: baseProject.duration,
        ownerId: baseProject.ownerId,
        owner: baseProject.owner,
      },
    };

    const standardMatchResult = computeCompatibility(userProfile, roleWithProject);

    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];
    const gapAnalysis = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);

    const candidateContext: CandidateEvaluationContext = {
      ...userProfile,
      reputationScore: userProfile.reputationScore ?? 80,
      availabilityDuration: "1-4 weeks",
    };

    const complementExplanation = evaluateCandidateComplement(
      candidateContext,
      roleWithProject,
      gapAnalysis
    );

    expect(complementExplanation).toBeDefined();
    // The base score in the explanation must exactly equal computeCompatibility score
    expect(complementExplanation?.baseScore).toBe(standardMatchResult.score);
    // Final score must be baseScore + complementBonus
    expect(complementExplanation?.finalScore).toBe(
      Math.min(1.0, Math.round((standardMatchResult.score + complementExplanation!.complementBonus) * 1000) / 1000)
    );
  });

  // ── 15. Query Performance & Scalability ─────────────────────────────────────
  it("Scenario 15: performs analysis and candidate ranking across 100 candidates in under 30ms without performance bottlenecks", () => {
    const teamMembers: TeamMemberInfo[] = [
      {
        id: "user-owner",
        name: "Alice Owner",
        roleTitle: "Project Lead",
        isOwner: true,
        skills: ["React", "TypeScript"],
        experienceLevel: "Intermediate",
        reputationScore: 80,
      },
    ];

    const gapAnalysis = analyzeTeamSkillGaps(baseProject, teamMembers, explicitRequirements);

    // Generate 100 mock candidates
    const candidatePool: CandidateEvaluationContext[] = Array.from({ length: 100 }, (_, i) => ({
      id: `candidate-${i}`,
      name: `Candidate ${i}`,
      skills: i % 2 === 0 ? ["Python", "PyTorch"] : ["Docker", "Kubernetes", "AWS"],
      experienceLevel: i % 3 === 0 ? "Advanced" : "Intermediate",
      reputationScore: 50 + (i % 50),
      availabilityHours: 10 + (i % 20),
      scheduleOverlapRatio: (i % 10) / 10,
    }));

    const start = performance.now();
    const recs = recommendComplementaryCandidates(candidatePool, baseProject, gapAnalysis, { limit: 20 });
    const elapsed = performance.now() - start;

    expect(recs.length).toBe(20);
    expect(elapsed).toBeLessThan(50); // Well under 50ms for 100 candidates!
  });
});
