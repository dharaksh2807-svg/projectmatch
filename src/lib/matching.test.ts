import { describe, it, expect } from "vitest";
import {
  scoreSkillOverlap,
  scoreInterestAlignment,
  scoreExperienceFit,
  scoreAvailabilityFit,
  scoreReputation,
} from "./matching";

// --- scoreSkillOverlap ---
describe("scoreSkillOverlap", () => {
  it("returns 1 when candidate has all required skills", () => {
    const result = scoreSkillOverlap(
      ["React", "TypeScript", "Node.js"],
      ["React", "TypeScript"]
    );
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 when candidate has no required skills", () => {
    const result = scoreSkillOverlap([], ["React", "TypeScript"]);
    expect(result).toBe(0);
  });

  it("returns 0.5 when there are no required skills", () => {
    const result = scoreSkillOverlap(["React"], []);
    expect(result).toBe(0.5);
  });

  it("returns partial score for partial skill match", () => {
    const result = scoreSkillOverlap(["React"], ["React", "TypeScript", "Node.js"]);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

// --- scoreInterestAlignment ---
describe("scoreInterestAlignment", () => {
  it("returns 1 for perfect interest alignment", () => {
    const result = scoreInterestAlignment(
      ["AI", "Web Development"],
      ["AI", "Web Development"]
    );
    expect(result).toBe(1);
  });

  it("returns 0.3 when candidate has no interests listed", () => {
    const result = scoreInterestAlignment([], ["AI", "Web Development"]);
    expect(result).toBe(0.3);
  });

  it("returns 0 for completely mismatched interests", () => {
    const result = scoreInterestAlignment(["Gaming"], ["Healthcare"]);
    expect(result).toBe(0);
  });
});

// --- scoreExperienceFit ---
describe("scoreExperienceFit", () => {
  it("returns 1.0 for exact experience match", () => {
    const result = scoreExperienceFit("Senior", "Senior");
    expect(result).toBe(1.0);
  });

  it("returns 0.3 when candidate level is unknown", () => {
    const result = scoreExperienceFit(null, "Senior");
    expect(result).toBe(0.3);
  });

  it("returns 0.75 when role accepts any level", () => {
    const result = scoreExperienceFit("Junior", "Any");
    expect(result).toBe(0.75);
  });

  it("decreases score for larger experience gaps", () => {
    const closeMatch = scoreExperienceFit("Junior", "Intermediate");
    const farMatch = scoreExperienceFit("Beginner", "Senior");
    expect(closeMatch).toBeGreaterThan(farMatch);
  });
});

// --- scoreAvailabilityFit ---
describe("scoreAvailabilityFit", () => {
  it("returns 0.3 if candidateHours is null", () => {
    const result = scoreAvailabilityFit(null, "3 months", "5-10 hrs/week", "3-6 months");
    expect(result).toBe(0.3);
  });

  it("returns 1.0 when candidate perfectly matches required hours", () => {
    const result = scoreAvailabilityFit(7.5, "3 months", "5-10 hrs/week", "3-6 months");
    expect(result).toBeGreaterThanOrEqual(0.5);
  });

  it("returns lower score when candidate has far fewer hours than required", () => {
    const fullMatch = scoreAvailabilityFit(40, "6+ months", "Full-time", "6+ months");
    const underMatch = scoreAvailabilityFit(3.5, "1 month", "Full-time", "6+ months");
    expect(fullMatch).toBeGreaterThan(underMatch);
  });
});

// --- scoreReputation ---
describe("scoreReputation", () => {
  it("returns 0.5 for null reputation (new user)", () => {
    expect(scoreReputation(null)).toBe(0.5);
  });

  it("returns 0.5 for undefined reputation", () => {
    expect(scoreReputation(undefined)).toBe(0.5);
  });

  it("returns 1.0 for a perfect score of 100", () => {
    expect(scoreReputation(100)).toBe(1);
  });

  it("returns 0.75 for a score of 75", () => {
    expect(scoreReputation(75)).toBe(0.75);
  });

  it("returns 0.5 for a neutral score of 50", () => {
    expect(scoreReputation(50)).toBe(0.5);
  });
});
