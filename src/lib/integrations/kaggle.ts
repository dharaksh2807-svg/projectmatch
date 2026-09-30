import { CompressedMetadata, IntegrationError } from "./types";

// Kaggle has a public meta.json at a predictable URL for each user.
const KAGGLE_BASE = "https://www.kaggle.com";

/** Kaggle tier progression — ordered from lowest to highest */
const KAGGLE_TIERS = ["Novice", "Contributor", "Expert", "Master", "Grandmaster"] as const;

interface KaggleMetaResponse {
  currentUser?: {
    userName?: string;
    displayName?: string;
    tier?: string;
    totalCompetitionMedals?: {
      gold?: number;
      silver?: number;
      bronze?: number;
    };
    totalNotebookMedals?: {
      gold?: number;
      silver?: number;
      bronze?: number;
    };
    ranking?: number;
    followersCount?: number;
  };
}

export async function fetchKaggle(handle: string): Promise<CompressedMetadata> {
  // Kaggle exposes a public JSON endpoint for user profile data
  let res: Response;
  try {
    res = await fetch(`${KAGGLE_BASE}/${encodeURIComponent(handle)}`, {
      headers: {
        // Pretend to be a browser to avoid 403s on the JSON endpoint
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; profile-sync/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new IntegrationError("kaggle", "Request timed out or network error", true);
  }

  // Kaggle doesn't have a clean public JSON API — parse meta from the page
  if (!res.ok) {
    if (res.status === 404) {
      throw new IntegrationError("kaggle", `User "${handle}" not found`);
    }
    throw new IntegrationError("kaggle", `HTTP ${res.status}`, res.status >= 500);
  }

  let html: string;
  try {
    html = await res.text();
  } catch {
    throw new IntegrationError("kaggle", "Failed to read response body");
  }

  // Extract __NEXT_DATA__ JSON blob embedded in Kaggle pages
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) {
    throw new IntegrationError("kaggle", "Could not parse profile data from page");
  }

  let pageData: { props?: { pageProps?: KaggleMetaResponse } };
  try {
    pageData = JSON.parse(match[1]) as typeof pageData;
  } catch {
    throw new IntegrationError("kaggle", "Invalid JSON in page data");
  }

  const user = pageData?.props?.pageProps?.currentUser;
  if (!user) {
    throw new IntegrationError("kaggle", `User "${handle}" not found or profile is private`);
  }

  // Total medals across competitions and notebooks
  const totalMedals =
    (user.totalCompetitionMedals?.gold ?? 0) +
    (user.totalCompetitionMedals?.silver ?? 0) +
    (user.totalCompetitionMedals?.bronze ?? 0) +
    (user.totalNotebookMedals?.gold ?? 0) +
    (user.totalNotebookMedals?.silver ?? 0) +
    (user.totalNotebookMedals?.bronze ?? 0);

  return {
    tier: KAGGLE_TIERS.includes(user.tier as (typeof KAGGLE_TIERS)[number])
      ? user.tier
      : undefined,
    medals: totalMedals > 0 ? totalMedals : undefined,
    rank: user.ranking ? String(user.ranking) : undefined,
    syncedAt: new Date().toISOString(),
  };
}
