import { describe, it, expect } from "vitest";
import {
  matchesTagList,
  matchesRoleCategory,
} from "./normalize";

describe("Discovery Filtering Integration Tests", () => {
  const sampleRoles = [
    {
      id: "role-1",
      title: "Senior Next.js Developer",
      description: "Building responsive interfaces for an AI-powered student dashboard.",
      requiredSkills: ["React", "TypeScript", "Tailwind CSS"],
      requiredExperienceLevel: "Intermediate",
      timeCommitment: "Part-time (10-15h/week)",
      headcount: 2,
      filledCount: 0,
      openSpots: 2,
      project: {
        title: "StudySync AI",
        projectType: "Hackathon",
        duration: "1-4 weeks",
        techStack: ["Next.js", "TypeScript", "Tailwind CSS", "FastAPI"],
        hackathon: {
          name: "Google Cloud GenAI Hackathon 2026",
          participationMode: "ONLINE",
          status: "UPCOMING",
          registrationStatus: "OPEN",
          tags: ["AI & ML", "Cloud & DevOps"],
        },
      },
    },
    {
      id: "role-2",
      title: "Backend Python Engineer",
      description: "Developing scalable REST APIs with FastAPI and PostgreSQL.",
      requiredSkills: ["Python", "FastAPI", "PostgreSQL"],
      requiredExperienceLevel: "Advanced",
      timeCommitment: "Full-time (30-40h/week)",
      headcount: 1,
      filledCount: 0,
      openSpots: 1,
      project: {
        title: "CampusConnect",
        projectType: "Startup",
        duration: "1-3 months",
        techStack: ["Python", "FastAPI", "PostgreSQL", "Docker"],
        hackathon: null,
      },
    },
    {
      id: "role-3",
      title: "Junior UI/UX Designer & Prototyper",
      description: "Creating wireframes and high-fidelity Figma components.",
      requiredSkills: ["UI/UX Design", "Figma", "Prototyping"],
      requiredExperienceLevel: "Beginner",
      timeCommitment: "Flexible",
      headcount: 1,
      filledCount: 1,
      openSpots: 0,
      project: {
        title: "EcoTrack",
        projectType: "Side Project",
        duration: "< 1 week",
        techStack: ["React", "Figma"],
        hackathon: null,
      },
    },
    {
      id: "role-4",
      title: "AI Agent & Prompt Engineer",
      description: "Building autonomous Gemini agents using LangChain.",
      requiredSkills: ["Python", "AI Agent Development", "LangChain"],
      requiredExperienceLevel: "Any",
      timeCommitment: "Part-time (5-10h/week)",
      headcount: 3,
      filledCount: 1,
      openSpots: 2,
      project: {
        title: "AgentVerse",
        projectType: "Hackathon",
        duration: "1-4 weeks",
        techStack: ["Python", "LangChain", "Gemini", "Next.js"],
        hackathon: {
          name: "CalHacks 12.0",
          participationMode: "HYBRID",
          status: "UPCOMING",
          registrationStatus: "OPEN",
          tags: ["AI & ML", "Open Source"],
        },
      },
    },
  ];

  it("filters correctly by single technology in ANY mode", () => {
    const matches = sampleRoles.filter((r) =>
      matchesTagList(["React"], [...r.project.techStack, ...r.requiredSkills], "any")
    );
    expect(matches.map((m) => m.id)).toEqual(["role-1", "role-3"]);
  });

  it("filters correctly by multiple technologies in ANY mode", () => {
    const matches = sampleRoles.filter((r) =>
      matchesTagList(["FastAPI", "Figma"], [...r.project.techStack, ...r.requiredSkills], "any")
    );
    expect(matches.map((m) => m.id)).toEqual(["role-1", "role-2", "role-3"]);
  });

  it("filters strictly by multiple technologies in ALL mode", () => {
    // Only role-1 has BOTH React and Next.js (alias normalized)
    const matches = sampleRoles.filter((r) =>
      matchesTagList(["Next.js", "React"], [...r.project.techStack, ...r.requiredSkills], "all")
    );
    expect(matches.map((m) => m.id)).toEqual(["role-1"]);
  });

  it("filters correctly by role category", () => {
    const frontendRoles = sampleRoles.filter((r) =>
      matchesRoleCategory(r.title, r.description, r.requiredSkills, "frontend")
    );
    expect(frontendRoles.map((r) => r.id)).toEqual(["role-1"]);

    const backendRoles = sampleRoles.filter((r) =>
      matchesRoleCategory(r.title, r.description, r.requiredSkills, "backend")
    );
    expect(backendRoles.map((r) => r.id)).toEqual(["role-2"]);

    const aimlRoles = sampleRoles.filter((r) =>
      matchesRoleCategory(r.title, r.description, r.requiredSkills, "aiml")
    );
    expect(aimlRoles.map((r) => r.id)).toEqual(["role-4"]);

    const designRoles = sampleRoles.filter((r) =>
      matchesRoleCategory(r.title, r.description, r.requiredSkills, "design")
    );
    expect(designRoles.map((r) => r.id)).toEqual(["role-3"]);
  });

  it("filters by beginner-friendly criteria (Beginner or Any)", () => {
    const beginnerRoles = sampleRoles.filter(
      (r) =>
        r.requiredExperienceLevel.toLowerCase() === "beginner" ||
        r.requiredExperienceLevel.toLowerCase() === "any"
    );
    expect(beginnerRoles.map((r) => r.id)).toEqual(["role-3", "role-4"]);
  });

  it("filters by open spots only (headcount > filledCount)", () => {
    const openRoles = sampleRoles.filter((r) => r.openSpots > 0);
    expect(openRoles.map((r) => r.id)).toEqual(["role-1", "role-2", "role-4"]);
    expect(openRoles.find((r) => r.id === "role-3")).toBeUndefined();
  });

  it("filters by hackathon participation mode", () => {
    const onlineRoles = sampleRoles.filter(
      (r) => r.project.hackathon?.participationMode === "ONLINE"
    );
    expect(onlineRoles.map((r) => r.id)).toEqual(["role-1"]);

    const hybridRoles = sampleRoles.filter(
      (r) => r.project.hackathon?.participationMode === "HYBRID"
    );
    expect(hybridRoles.map((r) => r.id)).toEqual(["role-4"]);
  });

  it("filters by duration correctly", () => {
    const shortRoles = sampleRoles.filter(
      (r) => r.project.duration === "1-4 weeks"
    );
    expect(shortRoles.map((r) => r.id)).toEqual(["role-1", "role-4"]);
  });

  it("combines multiple hard filters using AND without data corruption", () => {
    // Project Type: Hackathon + Role Category: aiml + Open Spots > 0
    const combined = sampleRoles.filter(
      (r) =>
        r.project.projectType === "Hackathon" &&
        matchesRoleCategory(r.title, r.description, r.requiredSkills, "aiml") &&
        r.openSpots > 0
    );
    expect(combined.map((r) => r.id)).toEqual(["role-4"]);
  });
});
