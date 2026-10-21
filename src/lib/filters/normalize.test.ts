import { describe, it, expect } from "vitest";
import {
  normalizeTag,
  tagMatches,
  matchesTagList,
  matchesRoleCategory,
  STANDARD_SKILLS,
  ALL_PREDEFINED_TECHS,
} from "./normalize";

describe("Filter Normalization Engine", () => {
  describe("normalizeTag", () => {
    it("maps common tech aliases to canonical forms", () => {
      expect(normalizeTag("reactjs")).toBe("React");
      expect(normalizeTag("next.js")).toBe("Next.js");
      expect(normalizeTag("nextjs")).toBe("Next.js");
      expect(normalizeTag("postgres")).toBe("PostgreSQL");
      expect(normalizeTag("postgresql")).toBe("PostgreSQL");
      expect(normalizeTag("k8s")).toBe("Kubernetes");
      expect(normalizeTag("tailwind")).toBe("Tailwind CSS");
      expect(normalizeTag("golang")).toBe("Go");
      expect(normalizeTag("py")).toBe("Python");
    });

    it("returns trimmed original tag if no alias matched", () => {
      expect(normalizeTag("UnknownFramework")).toBe("UnknownFramework");
    });
  });

  describe("tagMatches", () => {
    it("matches exact case-insensitive matches", () => {
      expect(tagMatches("react", "React")).toBe(true);
      expect(tagMatches("PYTHON", "python")).toBe(true);
    });

    it("matches aliases correctly", () => {
      expect(tagMatches("nextjs", "Next.js")).toBe(true);
      expect(tagMatches("react.js", "React")).toBe(true);
      expect(tagMatches("postgres", "PostgreSQL")).toBe(true);
      expect(tagMatches("k8s", "Kubernetes")).toBe(true);
    });

    it("handles boundary word matches", () => {
      expect(tagMatches("Tailwind", "Tailwind CSS")).toBe(true);
      expect(tagMatches("Tailwind CSS", "tailwind")).toBe(true);
    });

    it("does not match unrelated tags", () => {
      expect(tagMatches("React", "Vue")).toBe(false);
      expect(tagMatches("Python", "Rust")).toBe(false);
    });
  });

  describe("matchesTagList - ANY vs ALL semantics", () => {
    const candidateTechs = ["React", "TypeScript", "Tailwind CSS"];

    it("matches in ANY mode if at least one tech matches", () => {
      expect(matchesTagList(["React", "Python"], candidateTechs, "any")).toBe(true);
      expect(matchesTagList(["nextjs", "React"], candidateTechs, "any")).toBe(true);
      expect(matchesTagList(["Go", "Rust"], candidateTechs, "any")).toBe(false);
    });

    it("matches in ALL mode only if ALL requested techs match", () => {
      expect(matchesTagList(["React", "TypeScript"], candidateTechs, "all")).toBe(true);
      expect(matchesTagList(["reactjs", "ts"], candidateTechs, "all")).toBe(true);
      // Fails because Python is missing
      expect(matchesTagList(["React", "Python"], candidateTechs, "all")).toBe(false);
    });

    it("handles empty filters as matching everything", () => {
      expect(matchesTagList([], candidateTechs, "any")).toBe(true);
      expect(matchesTagList([], candidateTechs, "all")).toBe(true);
    });

    it("handles empty candidate target list", () => {
      expect(matchesTagList(["React"], [], "any")).toBe(false);
      expect(matchesTagList(["React"], [], "all")).toBe(false);
    });
  });

  describe("matchesRoleCategory", () => {
    it("matches frontend developer correctly", () => {
      expect(
        matchesRoleCategory("Senior Frontend Engineer", "Building web UI", ["React"], "frontend")
      ).toBe(true);
      expect(
        matchesRoleCategory("Backend Engineer", "Building APIs", ["FastAPI"], "frontend")
      ).toBe(false);
    });

    it("matches backend developer correctly", () => {
      expect(
        matchesRoleCategory("Backend Engineer", "Building APIs", ["FastAPI"], "backend")
      ).toBe(true);
    });

    it("matches AI/ML engineer correctly", () => {
      expect(
        matchesRoleCategory("AI Agent Developer", "Working with Gemini", ["Python", "LangChain"], "aiml")
      ).toBe(true);
    });

    it("handles All category as matching everything", () => {
      expect(matchesRoleCategory("Any Title", null, [], "All")).toBe(true);
    });
  });

  describe("Taxonomy separation", () => {
    it("keeps skills and technologies separate concepts", () => {
      expect(STANDARD_SKILLS.includes("Frontend Development")).toBe(true);
      expect(STANDARD_SKILLS.includes("React")).toBe(false);
      expect(ALL_PREDEFINED_TECHS.includes("React")).toBe(true);
      expect(ALL_PREDEFINED_TECHS.includes("Frontend Development")).toBe(false);
    });
  });
});
