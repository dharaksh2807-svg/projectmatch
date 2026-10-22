/**
 * Dynamic Technology Catalog & Taxonomy Engine
 *
 * Provides database-driven discovery of all technologies associated with
 * discoverable projects, popularity frequency calculation, canonical alias
 * resolution, category taxonomy mapping, and caching.
 */

import {
  ALL_PREDEFINED_TECHS,
  TECH_TAXONOMY,
  normalizeTag,
  tagMatches,
  STANDARD_SKILLS,
} from "./normalize";

export interface TechOption {
  name: string;
  count: number;
  category: string;
  isPopular: boolean;
}

export interface TechCatalogResponse {
  allTechnologies: string[];
  techCounts: Record<string, number>;
  popularTechs: string[];
  categories: Record<string, string[]>;
  totalDiscoverableProjects: number;
}

// Set of lowercase tags that represent skills or roles rather than technologies
export const LEGACY_SKILL_TAGS = new Set([
  "frontend",
  "ui",
  "ux",
  "backend",
  "fullstack",
  "design",
  "ui/ux",
  "ui/ux design",
  "frontend development",
  "backend development",
  "full-stack development",
  "product management",
  "devops",
  "graphic design",
  "user research",
]);

/**
 * Checks whether a tag is a skill or role rather than a technology.
 */
export function isSkillOrRoleTag(tag: string): boolean {
  const lower = tag.toLowerCase().trim();
  if (LEGACY_SKILL_TAGS.has(lower)) return true;
  return STANDARD_SKILLS.some((s) => s.toLowerCase() === lower);
}

/**
 * Maps standard categories to short, clean display labels
 */
export const CATEGORY_SHORT_NAMES: Record<string, string> = {
  "Frontend Frameworks": "Frontend",
  "Backend Frameworks": "Backend",
  "Programming Languages": "Languages",
  "Databases & ORMs": "Databases",
  "AI & ML Frameworks": "AI / ML",
  "Cloud & DevOps": "Cloud / DevOps",
  "Mobile Development": "Mobile",
  "Web3 & Blockchain": "Web3",
  "Hardware & IoT": "Hardware / IoT",
  "Other": "Other",
};

/**
 * Finds the appropriate taxonomy category for a given technology
 */
export function resolveTechCategory(techName: string): string {
  const norm = normalizeTag(techName).toLowerCase();
  // 1. Check exact canonical match in category taxonomy
  for (const [category, techs] of Object.entries(TECH_TAXONOMY)) {
    if (
      techs.some(
        (t) =>
          t.toLowerCase() === norm ||
          normalizeTag(t).toLowerCase() === norm
      )
    ) {
      return CATEGORY_SHORT_NAMES[category] || category;
    }
  }

  // 2. Fallback to tagMatches
  for (const [category, techs] of Object.entries(TECH_TAXONOMY)) {
    if (techs.some((t) => tagMatches(t, techName))) {
      return CATEGORY_SHORT_NAMES[category] || category;
    }
  }
  return "Other";
}

/**
 * Pure function to build a dynamic technology catalog from project and role data
 */
export function buildTechCatalog(
  projects: Array<{
    id?: string;
    techStack: string[];
    isPublished?: boolean;
    status?: string;
  }>,
  roles: Array<{ requiredSkills: string[] }> = []
): TechCatalogResponse {
  // Filter for discoverable projects (published & not archived)
  const discoverableProjects = projects.filter((p) => {
    if (p.isPublished === false) return false;
    if (p.status === "ARCHIVED") return false;
    return true;
  });

  const techCountMap: Record<string, number> = {};
  const distinctTechsMap = new Map<string, string>(); // lowercase -> canonical display name

  // 1. Process technologies explicitly saved in project techStacks
  for (const project of discoverableProjects) {
    if (!Array.isArray(project.techStack)) continue;

    // Deduplicate within the same project so a project doesn't vote twice for the same tech
    const projectSeenTechs = new Set<string>();

    for (const rawTag of project.techStack) {
      if (!rawTag || typeof rawTag !== "string") continue;
      const trimmed = rawTag.trim();
      if (!trimmed) continue;

      // Skip pure skill/role tags that were historically entered into techStack
      if (isSkillOrRoleTag(trimmed)) continue;

      const canonical = normalizeTag(trimmed);
      const key = canonical.toLowerCase();

      if (!projectSeenTechs.has(key)) {
        projectSeenTechs.add(key);
        distinctTechsMap.set(key, canonical);
        techCountMap[canonical] = (techCountMap[canonical] || 0) + 1;
      }
    }
  }

  // 2. Also inspect discoverable roles for skills that are known technologies (e.g. "React", "Python")
  for (const role of roles) {
    if (!Array.isArray(role.requiredSkills)) continue;
    for (const rawSkill of role.requiredSkills) {
      if (!rawSkill || typeof rawSkill !== "string") continue;
      const trimmed = rawSkill.trim();
      if (!trimmed || isSkillOrRoleTag(trimmed)) continue;

      const canonical = normalizeTag(trimmed);
      // If it's a known technology from our predefined taxonomy
      const isKnown = ALL_PREDEFINED_TECHS.some((t) => tagMatches(t, canonical));
      if (isKnown) {
        const key = canonical.toLowerCase();
        if (!distinctTechsMap.has(key)) {
          distinctTechsMap.set(key, canonical);
        }
      }
    }
  }

  // 3. Ensure all predefined taxonomy options are also available in the catalog
  for (const tech of ALL_PREDEFINED_TECHS) {
    const key = tech.toLowerCase();
    if (!distinctTechsMap.has(key)) {
      distinctTechsMap.set(key, tech);
    }
    if (!(tech in techCountMap)) {
      techCountMap[tech] = techCountMap[distinctTechsMap.get(key) || tech] || 0;
    }
  }

  // 4. Sort technologies:
  // - First by occurrence count in discoverable projects (descending)
  // - Then alphabetically by name (ascending)
  const allTechnologies = Array.from(distinctTechsMap.values()).sort((a, b) => {
    const countA = techCountMap[a] || 0;
    const countB = techCountMap[b] || 0;
    if (countB !== countA) return countB - countA;
    return a.localeCompare(b);
  });

  // 5. Select Popular Technologies (Top 8-12):
  // Pick technologies with count > 0 first.
  // If fewer than 10 have count > 0, backfill with deterministic default technologies.
  const DEFAULT_POPULAR_FALLBACK = [
    "React",
    "Next.js",
    "Python",
    "TypeScript",
    "Node.js",
    "PostgreSQL",
    "FastAPI",
    "Tailwind CSS",
    "Docker",
    "Java",
    "PyTorch",
    "Go",
  ];

  const popularCandidates = allTechnologies.filter((t) => (techCountMap[t] || 0) > 0);
  const popularSet = new Set<string>(popularCandidates.slice(0, 12));

  if (popularSet.size < 8) {
    for (const fallback of DEFAULT_POPULAR_FALLBACK) {
      if (popularSet.size >= 10) break;
      const matched = allTechnologies.find((t) => tagMatches(t, fallback)) || fallback;
      popularSet.add(matched);
    }
  }

  const popularTechs = Array.from(popularSet);

  // 6. Group technologies by category
  const categories: Record<string, string[]> = {
    Frontend: [],
    Backend: [],
    Languages: [],
    Databases: [],
    "AI / ML": [],
    "Cloud / DevOps": [],
    Mobile: [],
    Web3: [],
    "Hardware / IoT": [],
    Other: [],
  };

  for (const tech of allTechnologies) {
    const cat = resolveTechCategory(tech);
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(tech);
  }

  // Remove empty categories
  for (const [cat, items] of Object.entries(categories)) {
    if (items.length === 0) {
      delete categories[cat];
    }
  }

  return {
    allTechnologies,
    techCounts: techCountMap,
    popularTechs,
    categories,
    totalDiscoverableProjects: discoverableProjects.length,
  };
}
