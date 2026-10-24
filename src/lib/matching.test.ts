import { describe, it, expect } from "vitest";
import {
  scoreSkillOverlap,
  scoreInterestAlignment,
  scoreExperienceFit,
  scoreAvailabilityFit,
  scoreReputation,
  isUserProfileComplete,
  computeCompatibility,
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

// --- isUserProfileComplete & NaN Prevention ---
describe("Profile Completeness & Division-by-Zero Safety", () => {
  it("detects incomplete profiles when skills, experience, or availability are missing", () => {
    expect(isUserProfileComplete(null)).toBe(false);
    expect(isUserProfileComplete(undefined)).toBe(false);
    expect(
      isUserProfileComplete({
        skills: [],
        experienceLevel: null,
        availabilityHours: null,
      })
    ).toBe(false);
    expect(
      isUserProfileComplete({
        skills: ["React"],
        experienceLevel: null,
        availabilityHours: 10,
      })
    ).toBe(false);
    expect(
      isUserProfileComplete({
        skills: ["React"],
        experienceLevel: "Intermediate",
        availabilityHours: null,
        availabilityDuration: null,
      })
    ).toBe(false);
  });

  it("detects complete profile when skills, experience, and availability are populated", () => {
    expect(
      isUserProfileComplete({
        skills: ["React", "TypeScript"],
        experienceLevel: "Intermediate",
        availabilityHours: 10,
      })
    ).toBe(true);

    expect(
      isUserProfileComplete({
        skills: ["Design"],
        experienceLevel: "Beginner",
        availabilityDuration: "1-2 weeks",
      })
    ).toBe(true);
  });

  it("never produces NaN or division-by-zero on malformed or 0 commitment inputs", () => {
    const fit = scoreAvailabilityFit(0, "", "0 hrs/week", "0 weeks");
    expect(fit).toBe(0.3);
    expect(isNaN(fit)).toBe(false);

    const fitWithZeroHours = scoreAvailabilityFit(10, null, "0 hrs/week", "unknown");
    expect(isNaN(fitWithZeroHours)).toBe(false);
    expect(fitWithZeroHours).toBeGreaterThanOrEqual(0);
  });

  it("computes clean compatibility without NaN for empty user profiles", () => {
    const dummyRole = {
      id: "role-1",
      title: "Frontend Engineer",
      requiredSkills: ["React", "TypeScript"],
      requiredExperienceLevel: "Intermediate",
      timeCommitment: "10-20 hrs/week",
      headcount: 2,
      filledCount: 0,
      project: {
        id: "proj-1",
        title: "Test App",
        description: "A test project",
        projectType: "Hackathon",
        duration: "1-4 weeks",
        ownerId: "owner-1",
        owner: { name: "Owner", image: null },
      },
    };

    const emptyUser = {
      id: "user-empty",
      name: "Empty User",
      skills: [],
      interests: [],
      availabilityHours: null,
      experienceLevel: null,
    };

    const result = computeCompatibility(emptyUser, dummyRole);
    expect(result.isProfileComplete).toBe(false);
    expect(isNaN(result.score)).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(isNaN(result.breakdown.skillOverlap)).toBe(false);
    expect(isNaN(result.breakdown.availabilityFit)).toBe(false);
    expect(isNaN(result.breakdown.experienceFit)).toBe(false);
  });
});
