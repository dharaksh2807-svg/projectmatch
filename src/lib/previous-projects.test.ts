import { describe, it, expect } from "vitest";
import {
  previousProjectSchema,
  profileSchema,
  projectSchema,
  applicationActionSchema,
} from "@/lib/validations";

describe("PreviousProject & Drive Link Validations", () => {
  it("validates a complete previous project with demo link and Google Drive PDF/PPT link", () => {
    const validProject = {
      title: "AI Document Analyzer",
      description: "An automated PDF & PPT summarization pipeline using Gemini.",
      techStack: ["Next.js", "Python", "FastAPI", "Tailwind CSS"],
      projectUrl: "https://document-analyzer.vercel.app",
      githubUrl: "https://github.com/developer/document-analyzer",
      driveUrl: "https://drive.google.com/file/d/1a2b3c4d5e/view?usp=sharing",
      fileType: "Project Report (PDF)",
    };

    const parsed = previousProjectSchema.safeParse(validProject);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("AI Document Analyzer");
      expect(parsed.data.driveUrl).toBe("https://drive.google.com/file/d/1a2b3c4d5e/view?usp=sharing");
      expect(parsed.data.fileType).toBe("Project Report (PDF)");
    }
  });

  it("validates previous project with presentation slides (PPT)", () => {
    const pptProject = {
      title: "Smart Campus App Pitch Deck",
      description: "Slide deck presented at Hackathon Finals.",
      techStack: ["React Native", "Firebase"],
      driveUrl: "https://docs.google.com/presentation/d/1xyz-presentation/edit?usp=sharing",
      fileType: "Presentation (PPT / Slides)",
    };

    const parsed = previousProjectSchema.safeParse(pptProject);
    expect(parsed.success).toBe(true);
  });

  it("fails if title is too short or missing", () => {
    const invalidProject = {
      title: "A",
      driveUrl: "https://drive.google.com/file/d/123",
    };

    const parsed = previousProjectSchema.safeParse(invalidProject);
    expect(parsed.success).toBe(false);
  });

  it("fails if driveUrl is not a valid URL", () => {
    const invalidProject = {
      title: "Valid Title",
      driveUrl: "not-a-valid-url",
    };

    const parsed = previousProjectSchema.safeParse(invalidProject);
    expect(parsed.success).toBe(false);
  });

  it("allows empty or omitted optional links", () => {
    const minimalProject = {
      title: "Self-hosted Homelab",
      description: "Local Kubernetes setup for microservices.",
      projectUrl: "",
      githubUrl: "",
      driveUrl: "",
    };

    const parsed = previousProjectSchema.safeParse(minimalProject);
    expect(parsed.success).toBe(true);
  });

  it("integrates previous projects into profileSchema", () => {
    const profile = {
      name: "Alex River",
      bio: "Fullstack developer interested in AI and distributed systems.",
      skills: ["TypeScript", "Next.js", "Docker"],
      previousProjects: [
        {
          title: "Autonomous Drone Controller",
          description: "Flight controller built with C++ and ROS2.",
          techStack: ["C++", "ROS2", "Python"],
          projectUrl: "https://github.com/alex/drone-controller",
          driveUrl: "https://drive.google.com/file/d/drone-report.pdf",
          fileType: "Research Paper (PDF)",
        },
      ],
    };

    const parsed = profileSchema.safeParse(profile);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.previousProjects?.length).toBe(1);
      expect(parsed.data.previousProjects?.[0].fileType).toBe("Research Paper (PDF)");
    }
  });

  it("allows driveUrl on projectSchema for project creators sharing specs/slides", () => {
    const project = {
      title: "Decentralized Prediction Market",
      description: "A decentralized peer-to-peer prediction market on Polygon with automated oracle resolutions.",
      projectType: "Startup",
      duration: "1-3 months",
      techStack: ["Solidity", "Next.js", "Hardhat"],
      repoUrl: "https://github.com/startup/prediction-market",
      websiteUrl: "https://predictionmarket.app",
      driveUrl: "https://drive.google.com/file/d/pitch-deck.pptx",
      isPublished: true,
      roles: [
        {
          title: "Smart Contract Engineer",
          requiredSkills: ["Solidity", "EVM"],
          requiredExperienceLevel: "Intermediate",
          timeCommitment: "10-20 hrs/week",
          headcount: 2,
        },
      ],
    };

    const parsed = projectSchema.safeParse(project);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.driveUrl).toBe("https://drive.google.com/file/d/pitch-deck.pptx");
    }
  });

  it("validates proof of work attachments in applicationActionSchema", () => {
    const application = {
      roleId: "clq1234567890abcdef",
      message: "Here is my previous work on a similar real-time streaming dashboard.",
      projectUrl: "https://my-dashboard.vercel.app",
      driveUrl: "https://drive.google.com/file/d/case-study.pdf",
    };

    const parsed = applicationActionSchema.safeParse(application);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.projectUrl).toBe("https://my-dashboard.vercel.app");
      expect(parsed.data.driveUrl).toBe("https://drive.google.com/file/d/case-study.pdf");
    }
  });
});
