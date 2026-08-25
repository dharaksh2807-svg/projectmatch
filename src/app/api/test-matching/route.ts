import { NextResponse } from "next/server";
import {
  computeCompatibility,
  type RoleWithProject,
  type UserProfile,
} from "@/lib/matching";

export const runtime = "nodejs";

export async function GET() {
  // 1. Define Test Role
  const testRole: RoleWithProject = {
    id: "role-test-1",
    title: "Fullstack Engineer",
    requiredSkills: ["React", "TypeScript", "Node.js"],
    requiredExperienceLevel: "Mid-Level",
    timeCommitment: "15 hours/week",
    headcount: 1,
    filledCount: 0,
    project: {
      id: "project-test-1",
      title: "Fintech Platform",
      description: "Building next-generation financial services platform.",
      projectType: "Fintech",
      duration: "1-3 months",
      interests: ["Fintech"],
      ownerId: "owner-1",
      owner: {
        name: "Test Owner",
      },
    },
  };

  // 2. Define Test Candidates
  const candidateA: UserProfile = {
    id: "cand-a",
    name: "Candidate A (Ideal Match)",
    skills: ["React", "TypeScript", "Node.js"],
    availabilityHours: 15,
    availabilityDuration: "1-3 months",
    interests: ["Fintech"],
    experienceLevel: "Mid-Level",
    reputationScore: 4.8,
  };

  const candidateB: UserProfile = {
    id: "cand-b",
    name: "Candidate B (Partial Match)",
    skills: ["React"],
    availabilityHours: 5,
    availabilityDuration: "1-2 weeks",
    interests: ["EdTech"],
    experienceLevel: "Beginner",
    reputationScore: 4.0,
  };

  const candidateC: UserProfile = {
    id: "cand-c",
    name: "Candidate C (New User Edge Case)",
    skills: ["React", "TypeScript"],
    availabilityHours: 15,
    availabilityDuration: "1-3 months",
    interests: ["Fintech"],
    experienceLevel: "Mid-Level",
    reputationScore: null, // Null/undefined reputation
  };

  // 3. Compute Compatibility
  const resultA = computeCompatibility(candidateA, testRole);
  const resultB = computeCompatibility(candidateB, testRole);
  const resultC = computeCompatibility(candidateC, testRole);

  // Detailed breakdown formatting
  const responseData = {
    formula: "Final Score = (0.40 * SkillOverlap) + (0.20 * AvailabilityFit) + (0.15 * InterestAlignment) + (0.15 * ExperienceFit) + (0.10 * ReputationScore)",
    roleRequirements: {
      title: testRole.title,
      skills: testRole.requiredSkills,
      experienceLevel: testRole.requiredExperienceLevel,
      timeCommitment: testRole.timeCommitment,
      interests: testRole.project.interests,
    },
    candidates: [
      {
        candidate: candidateA.name,
        profile: {
          skills: candidateA.skills,
          availabilityHours: candidateA.availabilityHours,
          interests: candidateA.interests,
          experienceLevel: candidateA.experienceLevel,
          reputationScore: candidateA.reputationScore,
        },
        subScores: {
          skillOverlap: resultA.breakdown.skillOverlap,
          availabilityFit: resultA.breakdown.availabilityFit,
          interestAlignment: resultA.breakdown.interestAlignment,
          experienceFit: resultA.breakdown.experienceFit,
          reputationScore: resultA.breakdown.reputationScore,
        },
        weightedCalculation: {
          skillComponent: Number((0.40 * resultA.breakdown.skillOverlap).toFixed(4)),
          availabilityComponent: Number((0.20 * resultA.breakdown.availabilityFit).toFixed(4)),
          interestComponent: Number((0.15 * resultA.breakdown.interestAlignment).toFixed(4)),
          experienceComponent: Number((0.15 * resultA.breakdown.experienceFit).toFixed(4)),
          reputationComponent: Number((0.10 * resultA.breakdown.reputationScore).toFixed(4)),
        },
        finalScore: resultA.score,
        matchPercentage: `${(resultA.score * 100).toFixed(1)}%`,
      },
      {
        candidate: candidateB.name,
        profile: {
          skills: candidateB.skills,
          availabilityHours: candidateB.availabilityHours,
          interests: candidateB.interests,
          experienceLevel: candidateB.experienceLevel,
          reputationScore: candidateB.reputationScore,
        },
        subScores: {
          skillOverlap: resultB.breakdown.skillOverlap,
          availabilityFit: resultB.breakdown.availabilityFit,
          interestAlignment: resultB.breakdown.interestAlignment,
          experienceFit: resultB.breakdown.experienceFit,
          reputationScore: resultB.breakdown.reputationScore,
        },
        weightedCalculation: {
          skillComponent: Number((0.40 * resultB.breakdown.skillOverlap).toFixed(4)),
          availabilityComponent: Number((0.20 * resultB.breakdown.availabilityFit).toFixed(4)),
          interestComponent: Number((0.15 * resultB.breakdown.interestAlignment).toFixed(4)),
          experienceComponent: Number((0.15 * resultB.breakdown.experienceFit).toFixed(4)),
          reputationComponent: Number((0.10 * resultB.breakdown.reputationScore).toFixed(4)),
        },
        finalScore: resultB.score,
        matchPercentage: `${(resultB.score * 100).toFixed(1)}%`,
      },
      {
        candidate: candidateC.name,
        profile: {
          skills: candidateC.skills,
          availabilityHours: candidateC.availabilityHours,
          interests: candidateC.interests,
          experienceLevel: candidateC.experienceLevel,
          reputationScore: candidateC.reputationScore,
        },
        reputationHandlingProof: {
          rawReputationInput: candidateC.reputationScore,
          normalizedNeutralSubScore: resultC.breakdown.reputationScore,
          isNeutral0_5: resultC.breakdown.reputationScore === 0.5,
          explanation: "Candidate C has null reputation, so scoreReputation(null) returned 0.50 (neutral default), preventing any unfair penalty.",
        },
        subScores: {
          skillOverlap: resultC.breakdown.skillOverlap,
          availabilityFit: resultC.breakdown.availabilityFit,
          interestAlignment: resultC.breakdown.interestAlignment,
          experienceFit: resultC.breakdown.experienceFit,
          reputationScore: resultC.breakdown.reputationScore,
        },
        weightedCalculation: {
          skillComponent: Number((0.40 * resultC.breakdown.skillOverlap).toFixed(4)),
          availabilityComponent: Number((0.20 * resultC.breakdown.availabilityFit).toFixed(4)),
          interestComponent: Number((0.15 * resultC.breakdown.interestAlignment).toFixed(4)),
          experienceComponent: Number((0.15 * resultC.breakdown.experienceFit).toFixed(4)),
          reputationComponent: Number((0.10 * resultC.breakdown.reputationScore).toFixed(4)),
        },
        finalScore: resultC.score,
        matchPercentage: `${(resultC.score * 100).toFixed(1)}%`,
      },
    ],
  };

  return NextResponse.json(responseData);
}
