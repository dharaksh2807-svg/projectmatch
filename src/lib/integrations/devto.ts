import { CompressedMetadata, IntegrationError } from "./types";

const DEVTO_API = "https://dev.to/api/articles?username=";

export async function fetchDevTo(handle: string): Promise<CompressedMetadata> {
  let res: Response;
  try {
    res = await fetch(`${DEVTO_API}${encodeURIComponent(handle)}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new IntegrationError("devto", "Request timed out or network error", true);
  }

  if (!res.ok) {
    throw new IntegrationError("devto", `HTTP ${res.status}`, res.status >= 500);
  }

  let articles: { public_reactions_count?: number }[];
  try {
    articles = await res.json() as { public_reactions_count?: number }[];
  } catch {
    throw new IntegrationError("devto", "Invalid JSON from Dev.to API");
  }

  if (!Array.isArray(articles)) {
    throw new IntegrationError("devto", `User "${handle}" not found or invalid response`);
  }

  let totalReactions = 0;
  for (const article of articles) {
    totalReactions += article.public_reactions_count || 0;
  }

  return {
    solved: articles.length, // Mapping articles to solved
    rating: totalReactions,  // Mapping reactions to rating
    syncedAt: new Date().toISOString(),
  };
}
