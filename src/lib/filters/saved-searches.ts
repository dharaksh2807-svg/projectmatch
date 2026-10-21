import { z } from "zod";
import { ROLE_CATEGORIES } from "./normalize";

// ── Strict Saved Search Filter Schema (Allowlist) ────────────────────────────
export const SavedSearchFiltersSchema = z.object({
  q: z.string().max(120).optional().default(""),
  type: z.string().max(40).optional().default("All"),
  role: z.string().max(40).optional().default("All"),
  exp: z.string().max(30).optional().default("All"),
  duration: z.string().max(30).optional().default("All"),
  skill: z.array(z.string().max(50)).max(25).optional().default([]),
  skillMode: z.enum(["any", "all"]).optional().default("any"),
  tech: z.array(z.string().max(50)).max(25).optional().default([]),
  techMode: z.enum(["any", "all"]).optional().default("any"),
  hackathonId: z.string().max(60).optional().default("All"),
  mode: z.enum(["ALL", "ONLINE", "OFFLINE", "HYBRID"]).optional().default("ALL"),
  track: z.string().max(60).optional().default("All"),
  openRegOnly: z.boolean().optional().default(false),
  college: z.string().max(80).optional().default("ALL"),
  minSpots: z.number().int().min(0).max(50).optional().default(0),
  commitment: z.string().max(30).optional().default("All"),
  beginnerFriendly: z.boolean().optional().default(false),
  openOnly: z.boolean().optional().default(false),
  hideApplied: z.boolean().optional().default(false),
  bookmarkedOnly: z.boolean().optional().default(false),
  minScore: z.number().int().min(0).max(100).optional().default(0),
  sort: z.string().max(30).optional().default("match"),
});

export type SavedSearchFilters = z.infer<typeof SavedSearchFiltersSchema>;

// ── Saved Search Entity Validation Schemas ──────────────────────────────────
export const CreateSavedSearchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(60, "Name must be 60 characters or fewer"),
  context: z.enum(["ROLES", "HACKATHONS"]).default("ROLES"),
  filters: SavedSearchFiltersSchema,
});

export const UpdateSavedSearchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(60, "Name must be 60 characters or fewer")
    .optional(),
  filters: SavedSearchFiltersSchema.optional(),
});

export type CreateSavedSearchInput = z.infer<typeof CreateSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof UpdateSavedSearchSchema>;

// ── Built-in Reusable Filter Presets ─────────────────────────────────────────
export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  iconName: "Users" | "Sparkles" | "Cpu" | "Globe";
  filters: Partial<SavedSearchFilters>;
}

export const BUILT_IN_PRESETS: FilterPreset[] = [
  {
    id: "open-teams",
    name: "Open Teams",
    description: "Projects with immediately available open spots looking for members",
    badge: "Available Now",
    iconName: "Users",
    filters: {
      openOnly: true,
      minSpots: 1,
    },
  },
  {
    id: "beginner-friendly",
    name: "Beginner Friendly",
    description: "Welcoming teams suitable for first-time hackathon builders and beginners",
    badge: "Great for Starters",
    iconName: "Sparkles",
    filters: {
      beginnerFriendly: true,
      exp: "Beginner",
    },
  },
  {
    id: "aiml-projects",
    name: "AI/ML Projects",
    description: "Teams developing AI agents, Machine Learning, and LLM applications",
    badge: "Trending Tech",
    iconName: "Cpu",
    filters: {
      role: "aiml",
      tech: ["Python", "PyTorch"],
      techMode: "any",
    },
  },
  {
    id: "remote-hackathons",
    name: "Remote Hackathons",
    description: "Online hackathon teams and virtual competitions open to worldwide members",
    badge: "Virtual / Remote",
    iconName: "Globe",
    filters: {
      type: "Hackathon",
      mode: "ONLINE",
    },
  },
];

// ── Human-Readable Filter Summary Helper ─────────────────────────────────────
export interface FilterSummaryItem {
  key: string;
  category: string;
  label: string;
  isStale?: boolean;
}

export function buildFilterSummary(
  filters: Partial<SavedSearchFilters>,
  meta?: {
    availableHackathons?: { id: string; name: string }[];
    availableTechs?: string[];
    availableSkills?: string[];
  }
): FilterSummaryItem[] {
  const items: FilterSummaryItem[] = [];

  if (filters.q?.trim()) {
    items.push({
      key: "q",
      category: "Keywords",
      label: `"${filters.q.trim()}"`,
    });
  }

  if (filters.type && filters.type !== "All") {
    items.push({
      key: "type",
      category: "Type",
      label: filters.type,
    });
  }

  if (filters.role && filters.role !== "All") {
    const roleMatch = ROLE_CATEGORIES.find((r) => r.value === filters.role);
    items.push({
      key: "role",
      category: "Role",
      label: roleMatch ? roleMatch.label : filters.role,
    });
  }

  if (filters.exp && filters.exp !== "All") {
    items.push({
      key: "exp",
      category: "Experience",
      label: filters.exp,
    });
  }

  if (filters.duration && filters.duration !== "All") {
    items.push({
      key: "duration",
      category: "Duration",
      label: filters.duration,
    });
  }

  if (filters.tech && filters.tech.length > 0) {
    const isAll = filters.techMode === "all";
    const modeLabel = isAll ? "All" : "Any";
    items.push({
      key: "tech",
      category: "Tech",
      label: `${filters.tech.join(", ")} (${modeLabel})`,
    });
  }

  if (filters.skill && filters.skill.length > 0) {
    const isAll = filters.skillMode === "all";
    const modeLabel = isAll ? "All" : "Any";
    items.push({
      key: "skill",
      category: "Skills",
      label: `${filters.skill.join(", ")} (${modeLabel})`,
    });
  }

  if (filters.hackathonId && filters.hackathonId !== "All") {
    const foundHack = meta?.availableHackathons?.find((h) => h.id === filters.hackathonId);
    items.push({
      key: "hackathonId",
      category: "Hackathon",
      label: foundHack ? foundHack.name : "Specific Event",
      isStale: meta?.availableHackathons && !foundHack,
    });
  }

  if (filters.mode && filters.mode !== "ALL") {
    const modeLabels: Record<string, string> = {
      ONLINE: "Online / Virtual",
      OFFLINE: "In-Person",
      HYBRID: "Hybrid",
    };
    items.push({
      key: "mode",
      category: "Participation",
      label: modeLabels[filters.mode] || filters.mode,
    });
  }

  if (filters.track && filters.track !== "All") {
    items.push({
      key: "track",
      category: "Track",
      label: filters.track,
    });
  }

  if (filters.openRegOnly) {
    items.push({
      key: "openRegOnly",
      category: "Registration",
      label: "Registration Open",
    });
  }

  if (filters.college && filters.college !== "ALL") {
    items.push({
      key: "college",
      category: "College",
      label: filters.college,
    });
  }

  if (filters.minSpots && filters.minSpots > 0) {
    items.push({
      key: "minSpots",
      category: "Spots",
      label: `${filters.minSpots}+ spots`,
    });
  }

  if (filters.commitment && filters.commitment !== "All") {
    items.push({
      key: "commitment",
      category: "Commitment",
      label: filters.commitment,
    });
  }

  if (filters.beginnerFriendly) {
    items.push({
      key: "beginnerFriendly",
      category: "Difficulty",
      label: "Beginner Friendly",
    });
  }

  if (filters.openOnly) {
    items.push({
      key: "openOnly",
      category: "Status",
      label: "Open Vacancies Only",
    });
  }

  if (filters.hideApplied) {
    items.push({
      key: "hideApplied",
      category: "Status",
      label: "Hide Applied",
    });
  }

  if (filters.bookmarkedOnly) {
    items.push({
      key: "bookmarkedOnly",
      category: "Bookmarks",
      label: "Saved Only",
    });
  }

  if (filters.minScore && filters.minScore > 0) {
    items.push({
      key: "minScore",
      category: "Match",
      label: `${filters.minScore}%+ fit`,
    });
  }

  if (filters.sort && filters.sort !== "match") {
    const sortLabels: Record<string, string> = {
      newest: "Newest First",
      spots: "Most Spots",
      title: "Title (A–Z)",
      deadline: "Hackathon Deadline",
    };
    items.push({
      key: "sort",
      category: "Sort",
      label: sortLabels[filters.sort] || filters.sort,
    });
  }

  return items;
}

// ── Clean Shareable URL Generator (No Sensitive Tokens or User IDs) ─────────
export function generateShareableSearchUrl(
  filters: Partial<SavedSearchFilters>,
  basePath = "/discover"
): string {
  const params = new URLSearchParams();

  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.type && filters.type !== "All") params.set("type", filters.type);
  if (filters.role && filters.role !== "All") params.set("role", filters.role);
  if (filters.exp && filters.exp !== "All") params.set("exp", filters.exp);
  if (filters.duration && filters.duration !== "All") params.set("duration", filters.duration);

  if (filters.skill && filters.skill.length > 0) {
    filters.skill.forEach((s) => params.append("skill", s));
    if (filters.skillMode === "all") params.set("skillMode", "all");
  }

  if (filters.tech && filters.tech.length > 0) {
    filters.tech.forEach((t) => params.append("tech", t));
    if (filters.techMode === "all") params.set("techMode", "all");
  }

  if (filters.hackathonId && filters.hackathonId !== "All") {
    params.set("hackathonId", filters.hackathonId);
  }
  if (filters.mode && filters.mode !== "ALL") params.set("mode", filters.mode);
  if (filters.track && filters.track !== "All") params.set("track", filters.track);
  if (filters.openRegOnly) params.set("openRegOnly", "true");
  if (filters.college && filters.college !== "ALL") params.set("college", filters.college);

  if (filters.minSpots && filters.minSpots > 0) params.set("minSpots", filters.minSpots.toString());
  if (filters.commitment && filters.commitment !== "All") params.set("commitment", filters.commitment);
  if (filters.beginnerFriendly) params.set("beginnerFriendly", "true");
  if (filters.openOnly) params.set("openOnly", "true");
  if (filters.hideApplied) params.set("hideApplied", "true");
  if (filters.bookmarkedOnly) params.set("bookmarkedOnly", "true");
  if (filters.minScore && filters.minScore > 0) params.set("minScore", filters.minScore.toString());
  if (filters.sort && filters.sort !== "match") params.set("sort", filters.sort);

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// ── Check For Stale / Unavailable Filters ────────────────────────────────────
export function detectUnavailableFilters(
  filters: Partial<SavedSearchFilters>,
  meta: {
    availableTechs?: string[];
    availableSkills?: string[];
    availableHackathons?: { id: string; name: string }[];
  }
): { warnings: string[]; hasUnavailable: boolean } {
  const warnings: string[] = [];

  if (filters.tech && filters.tech.length > 0 && meta.availableTechs && meta.availableTechs.length > 0) {
    const lowerAvail = new Set(meta.availableTechs.map((t) => t.toLowerCase()));
    const missing = filters.tech.filter((t) => !lowerAvail.has(t.toLowerCase()));
    if (missing.length > 0) {
      warnings.push(`Technology option(s) no longer in active listings: ${missing.join(", ")}`);
    }
  }

  if (filters.skill && filters.skill.length > 0 && meta.availableSkills && meta.availableSkills.length > 0) {
    const lowerAvail = new Set(meta.availableSkills.map((s) => s.toLowerCase()));
    const missing = filters.skill.filter((s) => !lowerAvail.has(s.toLowerCase()));
    if (missing.length > 0) {
      warnings.push(`Skill option(s) no longer in active listings: ${missing.join(", ")}`);
    }
  }

  if (filters.hackathonId && filters.hackathonId !== "All" && meta.availableHackathons) {
    const found = meta.availableHackathons.some((h) => h.id === filters.hackathonId);
    if (!found) {
      warnings.push("The selected hackathon event has concluded or is no longer listed.");
    }
  }

  return {
    warnings,
    hasUnavailable: warnings.length > 0,
  };
}
