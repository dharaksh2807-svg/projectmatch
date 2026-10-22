import { describe, it, expect } from "vitest";
import {
  buildTechCatalog,
  resolveTechCategory,
  isSkillOrRoleTag,
} from "./tech-catalog";
import { matchesTagList } from "./normalize";

describe("Dynamic Technology Catalog & Filter Engine", () => {
  describe("Legacy Skills and Technologies Separation", () => {
    it("identifies frontend, ui, ux and other role/skill labels as non-technologies", () => {
      expect(isSkillOrRoleTag("frontend")).toBe(true);
      expect(isSkillOrRoleTag("ui")).toBe(true);
      expect(isSkillOrRoleTag("ux")).toBe(true);
      expect(isSkillOrRoleTag("ui/ux")).toBe(true);
      expect(isSkillOrRoleTag("backend")).toBe(true);
      expect(isSkillOrRoleTag("design")).toBe(true);
      expect(isSkillOrRoleTag("Frontend Development")).toBe(true);
    });

    it("identifies real technologies as valid technologies", () => {
      expect(isSkillOrRoleTag("React")).toBe(false);
      expect(isSkillOrRoleTag("Next.js")).toBe(false);
      expect(isSkillOrRoleTag("Python")).toBe(false);
      expect(isSkillOrRoleTag("PostgreSQL")).toBe(false);
      expect(isSkillOrRoleTag("FastAPI")).toBe(false);
      expect(isSkillOrRoleTag("Docker")).toBe(false);
    });

    it("filters out legacy skill tags from project tech stacks when building catalog", () => {
      const mockProjects = [
        {
          id: "p1",
          title: "Legacy Project",
          isPublished: true,
          status: "IN_PROGRESS",
          techStack: ["frontend", "ui", "ux", "React", "Next.js"],
        },
      ];

      const catalog = buildTechCatalog(mockProjects, []);
      // "frontend", "ui", "ux" should NOT be counted as technologies
      expect(catalog.techCounts["frontend"]).toBeUndefined();
      expect(catalog.techCounts["ui"]).toBeUndefined();
      expect(catalog.techCounts["ux"]).toBeUndefined();

      // Real technologies should be properly counted
      expect(catalog.techCounts["React"]).toBe(1);
      expect(catalog.techCounts["Next.js"]).toBe(1);
    });
  });

  describe("Dynamic Technology Extraction & Popularity Calculation", () => {
    it("extracts distinct technologies from all published projects regardless of pagination", () => {
      const mockProjects = [
        {
          id: "p1",
          title: "AI Study Buddy",
          isPublished: true,
          status: "IN_PROGRESS",
          techStack: ["React", "Next.js", "PostgreSQL", "FastAPI"],
        },
        {
          id: "p2",
          title: "Healthcare Chatbot",
          isPublished: true,
          status: "IN_PROGRESS",
          techStack: ["Python", "FastAPI", "PyTorch", "Docker"],
        },
        {
          id: "p3",
          title: "E-Commerce Microservices",
          isPublished: true,
          status: "IN_PROGRESS",
          techStack: ["Java", "Spring Boot", "MySQL", "Docker", "FastAPI"],
        },
      ];

      const catalog = buildTechCatalog(mockProjects, []);

      // FastAPI is used in 3 projects
      expect(catalog.techCounts["FastAPI"]).toBe(3);
      // Docker is used in 2 projects
      expect(catalog.techCounts["Docker"]).toBe(2);
      // React, Next.js, PostgreSQL, Python, PyTorch, Java, Spring Boot, MySQL are each in 1 project
      expect(catalog.techCounts["React"]).toBe(1);
      expect(catalog.techCounts["Next.js"]).toBe(1);
      expect(catalog.techCounts["Python"]).toBe(1);
      expect(catalog.techCounts["PyTorch"]).toBe(1);

      // Popular technologies should start with the most frequent (FastAPI, Docker)
      expect(catalog.popularTechs[0]).toBe("FastAPI");
      expect(catalog.popularTechs[1]).toBe("Docker");
    });

    it("normalizes aliases to canonical names without duplicate counts", () => {
      const mockProjects = [
        {
          id: "p1",
          isPublished: true,
          techStack: ["reactjs", "nextjs", "postgres"],
        },
        {
          id: "p2",
          isPublished: true,
          techStack: ["React", "Next.js", "PostgreSQL"],
        },
        {
          id: "p3",
          isPublished: true,
          techStack: ["react.js", "NEXT.JS", "postgresql"],
        },
      ];

      const catalog = buildTechCatalog(mockProjects, []);

      // All variations should be mapped to the canonical name
      expect(catalog.techCounts["React"]).toBe(3);
      expect(catalog.techCounts["Next.js"]).toBe(3);
      expect(catalog.techCounts["PostgreSQL"]).toBe(3);

      // Raw aliases should not appear as separate duplicate entries
      expect(catalog.techCounts["reactjs"]).toBeUndefined();
      expect(catalog.techCounts["nextjs"]).toBeUndefined();
      expect(catalog.techCounts["postgres"]).toBeUndefined();
    });

    it("strictly excludes unpublished or archived projects", () => {
      const mockProjects = [
        {
          id: "p1",
          title: "Published Active",
          isPublished: true,
          status: "IN_PROGRESS",
          techStack: ["React", "TypeScript"],
        },
        {
          id: "p2",
          title: "Draft Project",
          isPublished: false, // private / unpublished
          status: "IN_PROGRESS",
          techStack: ["SecretTechAlpha", "Python"],
        },
        {
          id: "p3",
          title: "Archived Project",
          isPublished: true,
          status: "ARCHIVED", // archived
          techStack: ["DeprecatedFramework", "Python"],
        },
      ];

      const catalog = buildTechCatalog(mockProjects, []);

      expect(catalog.techCounts["SecretTechAlpha"]).toBeUndefined();
      expect(catalog.techCounts["DeprecatedFramework"]).toBeUndefined();
      expect(catalog.techCounts["React"]).toBe(1);
      expect(catalog.totalDiscoverableProjects).toBe(1);
    });

    it("allows newly created custom technologies to become immediately discoverable", () => {
      const mockProjects = [
        {
          id: "p1",
          isPublished: true,
          techStack: ["Bun", "SurrealDB", "Tauri"],
        },
      ];

      const catalog = buildTechCatalog(mockProjects, []);

      expect(catalog.allTechnologies).toContain("Bun");
      expect(catalog.allTechnologies).toContain("SurrealDB");
      expect(catalog.allTechnologies).toContain("Tauri");
      expect(catalog.techCounts["Bun"]).toBe(1);
      expect(catalog.techCounts["SurrealDB"]).toBe(1);
    });
  });

  describe("Category Taxonomy Mapping", () => {
    it("maps technologies to correct taxonomy categories", () => {
      expect(resolveTechCategory("React")).toBe("Frontend");
      expect(resolveTechCategory("Next.js")).toBe("Frontend");
      expect(resolveTechCategory("FastAPI")).toBe("Backend");
      expect(resolveTechCategory("Node.js")).toBe("Backend");
      expect(resolveTechCategory("Python")).toBe("Languages");
      expect(resolveTechCategory("TypeScript")).toBe("Languages");
      expect(resolveTechCategory("PostgreSQL")).toBe("Databases");
      expect(resolveTechCategory("Redis")).toBe("Databases");
      expect(resolveTechCategory("PyTorch")).toBe("AI / ML");
      expect(resolveTechCategory("LangChain")).toBe("AI / ML");
      expect(resolveTechCategory("Docker")).toBe("Cloud / DevOps");
      expect(resolveTechCategory("AWS")).toBe("Cloud / DevOps");
      expect(resolveTechCategory("React Native")).toBe("Mobile");
      expect(resolveTechCategory("Flutter")).toBe("Mobile");
      expect(resolveTechCategory("Solidity")).toBe("Web3");
      expect(resolveTechCategory("Arduino")).toBe("Hardware / IoT");
      expect(resolveTechCategory("SomeRandomNewTool")).toBe("Other");
    });

    it("groups all catalog technologies into populated category lists", () => {
      const mockProjects = [
        {
          id: "p1",
          isPublished: true,
          techStack: ["React", "FastAPI", "Python", "PostgreSQL", "Docker", "PyTorch"],
        },
      ];

      const catalog = buildTechCatalog(mockProjects, []);

      expect(catalog.categories["Frontend"]).toContain("React");
      expect(catalog.categories["Backend"]).toContain("FastAPI");
      expect(catalog.categories["Languages"]).toContain("Python");
      expect(catalog.categories["Databases"]).toContain("PostgreSQL");
      expect(catalog.categories["Cloud / DevOps"]).toContain("Docker");
      expect(catalog.categories["AI / ML"]).toContain("PyTorch");
    });
  });

  describe("Match ANY vs Match ALL Semantics", () => {
    const testProject = {
      techStack: ["React", "Next.js", "Tailwind CSS", "FastAPI"],
    };

    it("matches ANY: returns true if at least one selected tech matches", () => {
      // One matches (React)
      expect(
        matchesTagList(["React", "PyTorch"], testProject.techStack, "any")
      ).toBe(true);

      // None matches
      expect(
        matchesTagList(["PyTorch", "Django"], testProject.techStack, "any")
      ).toBe(false);
    });

    it("matches ALL: returns true only if every selected tech matches", () => {
      // Both match (React and FastAPI)
      expect(
        matchesTagList(["React", "FastAPI"], testProject.techStack, "all")
      ).toBe(true);

      // Only one matches (React matches, PyTorch does not) -> should be false
      expect(
        matchesTagList(["React", "PyTorch"], testProject.techStack, "all")
      ).toBe(false);

      // All 3 match
      expect(
        matchesTagList(["React", "Next.js", "Tailwind CSS"], testProject.techStack, "all")
      ).toBe(true);
    });

    it("handles alias variations when evaluating match", () => {
      // "reactjs" alias matches "React" in techStack
      expect(
        matchesTagList(["reactjs"], testProject.techStack, "any")
      ).toBe(true);

      // "next" alias matches "Next.js" in techStack
      expect(
        matchesTagList(["next"], testProject.techStack, "any")
      ).toBe(true);
    });

    it("empty filter array returns true (no filter applied)", () => {
      expect(matchesTagList([], testProject.techStack, "any")).toBe(true);
      expect(matchesTagList([], testProject.techStack, "all")).toBe(true);
    });
  });
});
