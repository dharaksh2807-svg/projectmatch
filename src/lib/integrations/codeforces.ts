import { CompressedMetadata, IntegrationError } from "./types";

// Official Codeforces REST API — no auth required for public data.
const CF_BASE = "https://codeforces.com/api";

interface CFUserInfoResponse {
  status: string;
  result?: {
    handle: string;
    rating?: number;
    maxRating?: number;
    rank?: string;
  }[];
  comment?: string;
}

interface CFSubmissionsResponse {
  status: string;
  result?: {
    verdict: string;
    problem: {
      tags: string[];
    };
    programmingLanguage: string;
  }[];
}

export async function fetchCodeforces(handle: string): Promise<CompressedMetadata> {
  // 1. Fetch user rating info and 2. recent accepted submissions in parallel
  let userRes: Response;
  let subsRes: Response;

  try {
    [userRes, subsRes] = await Promise.all([
      fetch(`${CF_BASE}/user.info?handles=${encodeURIComponent(handle)}`, {
        signal: AbortSignal.timeout(8000),
      }),
      // Fetch last 100 submissions to extract language distribution
      fetch(
        `${CF_BASE}/user.status?handle=${encodeURIComponent(handle)}&from=1&count=100`,
        { signal: AbortSignal.timeout(8000) }
      ),
    ]);
  } catch {
    throw new IntegrationError("codeforces", "Request timed out or network error", true);
  }

  if (!userRes.ok) {
    throw new IntegrationError("codeforces", `HTTP ${userRes.status}`, userRes.status >= 500);
  }

  let userJson: CFUserInfoResponse;
  try {
    userJson = await userRes.json() as CFUserInfoResponse;
  } catch {
    throw new IntegrationError("codeforces", "Invalid JSON from user.info");
  }

  if (userJson.status !== "OK" || !userJson.result?.[0]) {
    throw new IntegrationError(
      "codeforces",
      userJson.comment ?? `User "${handle}" not found`
    );
  }

  const user = userJson.result[0];

  // Extract language distribution from recent submissions
  let topLangs: string[] | undefined;
  if (subsRes.ok) {
    try {
      const subsJson = await subsRes.json() as CFSubmissionsResponse;
      if (subsJson.status === "OK" && subsJson.result) {
        // Count accepted submissions per language
        const langCount: Record<string, number> = {};
        for (const sub of subsJson.result) {
          if (sub.verdict === "OK") {
            const lang = sub.programmingLanguage;
            langCount[lang] = (langCount[lang] ?? 0) + 1;
          }
        }
        topLangs = Object.entries(langCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([lang]) => lang);
      }
    } catch {
      // Non-critical — continue without language data
    }
  }

  return {
    rating: user.rating,
    maxRating: user.maxRating,
    rank: user.rank,
    langs: topLangs && topLangs.length > 0 ? topLangs : undefined,
    syncedAt: new Date().toISOString(),
  };
}
