import { describe, it, expect } from "vitest";
import {
  SavedSearchFiltersSchema,
  CreateSavedSearchSchema,
  UpdateSavedSearchSchema,
  BUILT_IN_PRESETS,
  buildFilterSummary,
  generateShareableSearchUrl,
  detectUnavailableFilters,
} from "./saved-searches";

describe("Saved Search Schemas & Allowlist Validation", () => {
  it("validates a complete, valid filter payload", () => {
    const valid = {
      q: "full stack nextjs",
      type: "Hackathon",
      role: "fullstack",
      exp: "Intermediate",
      duration: "1-2 weeks",
      skill: ["Full-Stack Development", "API Integration"],
      skillMode: "all",
      tech: ["React", "Next.js", "TypeScript"],
      techMode: "all",
      hackathonId: "hack-123",
      mode: "ONLINE",
      track: "Generative AI",
      openRegOnly: true,
      college: "Stanford",
      minSpots: 2,
      commitment: "Part-time (10-20 hrs/wk)",
      beginnerFriendly: true,
      openOnly: true,
      hideApplied: true,
      bookmarkedOnly: false,
      minScore: 75,
      sort: "match",
    };

    const parsed = SavedSearchFiltersSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.q).toBe("full stack nextjs");
      expect(parsed.data.minSpots).toBe(2);
      expect(parsed.data.mode).toBe("ONLINE");
    }
  });

  it("applies sensible defaults for empty or minimal filter payloads", () => {
    const parsed = SavedSearchFiltersSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.q).toBe("");
      expect(parsed.data.type).toBe("All");
      expect(parsed.data.role).toBe("All");
      expect(parsed.data.tech).toEqual([]);
      expect(parsed.data.techMode).toBe("any");
      expect(parsed.data.openOnly).toBe(false);
      expect(parsed.data.minSpots).toBe(0);
    }
  });

  it("rejects search name exceeding 60 characters", () => {
    const longName = "A".repeat(61);
    const result = CreateSavedSearchSchema.safeParse({
      name: longName,
      context: "ROLES",
      filters: {},
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("60 characters");
    }
  });

  it("rejects empty or whitespace-only search names", () => {
    const result = CreateSavedSearchSchema.safeParse({
      name: "   ",
      context: "ROLES",
      filters: {},
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid mode or out-of-range numerical bounds", () => {
    const invalidMode = SavedSearchFiltersSchema.safeParse({
      mode: "INVALID_MODE",
    });
    expect(invalidMode.success).toBe(false);

    const invalidSpots = SavedSearchFiltersSchema.safeParse({
      minSpots: -5,
    });
    expect(invalidSpots.success).toBe(false);

    const invalidScore = SavedSearchFiltersSchema.safeParse({
      minScore: 150,
    });
    expect(invalidScore.success).toBe(false);
  });

  it("validates partial updates using UpdateSavedSearchSchema", () => {
    const renameOnly = UpdateSavedSearchSchema.safeParse({
      name: "New Name",
    });
    expect(renameOnly.success).toBe(true);

    const filterOnly = UpdateSavedSearchSchema.safeParse({
      filters: { minSpots: 3, openOnly: true },
    });
    expect(filterOnly.success).toBe(true);
  });
});

describe("Built-in Filter Presets", () => {
  it("provides the required canonical presets", () => {
    const presetIds = BUILT_IN_PRESETS.map((p) => p.id);
    expect(presetIds).toContain("open-teams");
    expect(presetIds).toContain("beginner-friendly");
    expect(presetIds).toContain("aiml-projects");
    expect(presetIds).toContain("remote-hackathons");
  });

  it("all built-in preset filters pass strict validation schema", () => {
    for (const preset of BUILT_IN_PRESETS) {
      const parsed = SavedSearchFiltersSchema.safeParse(preset.filters);
      expect(parsed.success).toBe(true);
    }
  });

  it("Open Teams preset specifies openOnly and minSpots", () => {
    const openTeams = BUILT_IN_PRESETS.find((p) => p.id === "open-teams");
    expect(openTeams?.filters.openOnly).toBe(true);
    expect(openTeams?.filters.minSpots).toBe(1);
  });

  it("Beginner Friendly preset specifies beginnerFriendly and Beginner exp", () => {
    const beginner = BUILT_IN_PRESETS.find((p) => p.id === "beginner-friendly");
    expect(beginner?.filters.beginnerFriendly).toBe(true);
    expect(beginner?.filters.exp).toBe("Beginner");
  });

  it("Remote Hackathons preset specifies Hackathon and ONLINE mode", () => {
    const remote = BUILT_IN_PRESETS.find((p) => p.id === "remote-hackathons");
    expect(remote?.filters.type).toBe("Hackathon");
    expect(remote?.filters.mode).toBe("ONLINE");
  });
});

describe("buildFilterSummary", () => {
  it("generates human-readable badges for active filters", () => {
    const filters = {
      q: "Fintech",
      type: "Hackathon",
      role: "aiml",
      tech: ["Python", "FastAPI"],
      techMode: "all" as const,
      mode: "ONLINE" as const,
      beginnerFriendly: true,
      openOnly: true,
      minSpots: 2,
    };

    const summary = buildFilterSummary(filters, {
      availableHackathons: [],
    });

    const categories = summary.map((s) => s.category);
    expect(categories).toContain("Keywords");
    expect(categories).toContain("Type");
    expect(categories).toContain("Role");
    expect(categories).toContain("Tech");
    expect(categories).toContain("Participation");
    expect(categories).toContain("Difficulty");
    expect(categories).toContain("Status");
    expect(categories).toContain("Spots");

    const techItem = summary.find((s) => s.category === "Tech");
    expect(techItem?.label).toBe("Python, FastAPI (All)");

    const modeItem = summary.find((s) => s.category === "Participation");
    expect(modeItem?.label).toBe("Online / Virtual");

    const roleItem = summary.find((s) => s.category === "Role");
    expect(roleItem?.label).toBe("AI / ML Engineer");
  });

  it("returns empty summary when only default options are selected", () => {
    const summary = buildFilterSummary({
      type: "All",
      role: "All",
      exp: "All",
      duration: "All",
      mode: "ALL",
    });

    expect(summary.length).toBe(0);
  });
});

describe("generateShareableSearchUrl", () => {
  it("constructs a clean, safe URL without sensitive tokens or user IDs", () => {
    const filters = {
      q: "GenAI Hackathon",
      type: "Hackathon",
      role: "aiml",
      tech: ["Python", "PyTorch"],
      techMode: "all" as const,
      mode: "ONLINE" as const,
      openOnly: true,
      minSpots: 1,
    };

    const url = generateShareableSearchUrl(filters, "/discover");

    // Pure search params
    expect(url).toContain("/discover?");
    expect(url).toContain("q=GenAI+Hackathon");
    expect(url).toContain("type=Hackathon");
    expect(url).toContain("role=aiml");
    expect(url).toContain("tech=Python");
    expect(url).toContain("tech=PyTorch");
    expect(url).toContain("techMode=all");
    expect(url).toContain("mode=ONLINE");
    expect(url).toContain("openOnly=true");
    expect(url).toContain("minSpots=1");

    // Absolute zero private or session identifiers
    expect(url).not.toContain("userId");
    expect(url).not.toContain("session");
    expect(url).not.toContain("token");
    expect(url).not.toContain("password");
    expect(url).not.toContain("auth");
  });

  it("returns basePath when no filters are active", () => {
    const url = generateShareableSearchUrl({}, "/discover");
    expect(url).toBe("/discover");
  });
});

describe("detectUnavailableFilters", () => {
  it("detects when a technology in a saved search is missing from available listings", () => {
    const result = detectUnavailableFilters(
      { tech: ["React", "COBOL_Legacy"] },
      {
        availableTechs: ["React", "Next.js", "Python"],
        availableSkills: ["Frontend Development"],
        availableHackathons: [],
      }
    );

    expect(result.hasUnavailable).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("COBOL_Legacy");
  });

  it("detects when a selected hackathon event is no longer active", () => {
    const result = detectUnavailableFilters(
      { hackathonId: "concluded-event-id" },
      {
        availableTechs: ["React"],
        availableSkills: ["Frontend Development"],
        availableHackathons: [{ id: "active-hackathon-1", name: "HackAI 2026" }],
      }
    );

    expect(result.hasUnavailable).toBe(true);
    expect(result.warnings[0]).toContain("concluded or is no longer listed");
  });

  it("reports no warnings when all options are available in current listings", () => {
    const result = detectUnavailableFilters(
      {
        tech: ["React", "Next.js"],
        skill: ["Frontend Development"],
        hackathonId: "active-hackathon-1",
      },
      {
        availableTechs: ["React", "Next.js", "Python"],
        availableSkills: ["Frontend Development", "Machine Learning"],
        availableHackathons: [{ id: "active-hackathon-1", name: "HackAI 2026" }],
      }
    );

    expect(result.hasUnavailable).toBe(false);
    expect(result.warnings.length).toBe(0);
  });
});
