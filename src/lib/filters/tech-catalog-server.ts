import "server-only";
import { prisma } from "@/lib/prisma";
import { buildTechCatalog, TechCatalogResponse } from "./tech-catalog";

// In-memory catalog cache with 30-second TTL
let cachedCatalog: TechCatalogResponse | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30_000;

export function invalidateTechCatalogCache(): void {
  cachedCatalog = null;
  lastCacheTime = 0;
}

/**
 * Fetches and builds the technology catalog from the database with in-memory caching.
 * Exclusively executes on the server runtime.
 */
export async function getDiscoverableTechCatalog(
  db: typeof prisma = prisma,
  bypassCache = false
): Promise<TechCatalogResponse> {
  const now = Date.now();
  if (!bypassCache && cachedCatalog && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  try {
    const [projects, roles] = await Promise.all([
      db.project.findMany({
        where: {
          isPublished: true,
          status: { not: "ARCHIVED" },
        },
        select: {
          id: true,
          techStack: true,
          isPublished: true,
          status: true,
        },
      }),
      db.role.findMany({
        where: {
          isOpen: true,
          project: {
            isPublished: true,
            status: { not: "ARCHIVED" },
          },
        },
        select: {
          requiredSkills: true,
        },
      }),
    ]);

    const catalog = buildTechCatalog(projects, roles);
    cachedCatalog = catalog;
    lastCacheTime = now;
    return catalog;
  } catch (err) {
    console.error("Failed to query discoverable tech catalog from DB:", err);
    // Graceful fallback to taxonomy if DB connection fails
    return buildTechCatalog([], []);
  }
}
