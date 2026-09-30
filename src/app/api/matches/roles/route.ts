import { NextResponse } from "next/server";

/**
 * GET /api/matches/roles
 *
 * Returns a list of mock matched roles for the Discover page.
 * Each role includes project info, owner info, and a compatibility score.
 * This endpoint is public (accessible to guests for browsing).
 */
const mockRoles = [
  {
    id: "role-1",
    title: "Senior Next.js Developer",
    requiredSkills: ["React", "Next.js", "TypeScript"],
    requiredExperienceLevel: "Advanced",
    timeCommitment: "Part-time (10-15h/week)",
    headcount: 2,
    filledCount: 0,
    project: {
      id: "proj-1",
      title: "AI Project Management Tool",
      description:
        "Building a revolutionary AI-powered tool to help PMs automate Jira workflows and sprint planning.",
      projectType: "Startup",
      duration: "3-6 months",
      ownerId: "user-1",
      owner: {
        name: "Alice Chen",
        image: null,
        reputationScore: 92,
      },
    },
    compatibility: {
      score: 0.85,
      breakdown: {
        skillOverlap: 0.9,
        availabilityFit: 0.8,
        interestAlignment: 0.85,
        experienceFit: 0.9,
        reputationScore: 0.8,
      },
    },
  },
  {
    id: "role-2",
    title: "Machine Learning Engineer",
    requiredSkills: ["Python", "PyTorch", "LLMs"],
    requiredExperienceLevel: "Intermediate",
    timeCommitment: "Full-time",
    headcount: 1,
    filledCount: 0,
    project: {
      id: "proj-2",
      title: "Open Source LLM Evaluator",
      description:
        "An open-source framework for evaluating RAG pipelines and LLM agents with reproducible benchmarks.",
      projectType: "Open Source",
      duration: "6+ months",
      ownerId: "user-2",
      owner: {
        name: "Bob Kumar",
        image: null,
        reputationScore: 85,
      },
    },
    compatibility: {
      score: 0.45,
      breakdown: {
        skillOverlap: 0.3,
        availabilityFit: 0.5,
        interestAlignment: 0.7,
        experienceFit: 0.5,
        reputationScore: 0.25,
      },
    },
  },
  {
    id: "role-3",
    title: "UI/UX Designer",
    requiredSkills: ["Figma", "Tailwind CSS"],
    requiredExperienceLevel: "Beginner",
    timeCommitment: "Flexible",
    headcount: 3,
    filledCount: 1,
    project: {
      id: "proj-3",
      title: "Hackathon: EcoTrack App",
      description:
        "A mobile app to track personal carbon footprints for the Global Green Hackathon.",
      projectType: "Hackathon",
      duration: "< 1 week",
      ownerId: "user-3",
      owner: {
        name: "Eve Johnson",
        image: null,
      },
    },
    compatibility: {
      score: 0.95,
      breakdown: {
        skillOverlap: 1.0,
        availabilityFit: 0.95,
        interestAlignment: 0.9,
        experienceFit: 0.95,
        reputationScore: 0.95,
      },
    },
  },
];

export async function GET() {
  return NextResponse.json({ results: mockRoles });
}
