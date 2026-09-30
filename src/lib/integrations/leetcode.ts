import { CompressedMetadata, IntegrationError } from "./types";

// LeetCode has a public GraphQL endpoint — no API key required.
const LEETCODE_GQL = "https://leetcode.com/graphql";

const STATS_QUERY = `
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    profile {
      ranking
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
    languageProblemCount {
      languageName
      problemsSolved
    }
  }
}`;

interface LeetCodeResponse {
  data: {
    matchedUser: {
      profile: { ranking: number };
      submitStatsGlobal: {
        acSubmissionNum: { difficulty: string; count: number }[];
      };
      languageProblemCount: { languageName: string; problemsSolved: number }[];
    } | null;
  };
}

export async function fetchLeetCode(handle: string): Promise<CompressedMetadata> {
  let res: Response;
  try {
    res = await fetch(LEETCODE_GQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
      },
      body: JSON.stringify({ query: STATS_QUERY, variables: { username: handle } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new IntegrationError("leetcode", "Request timed out or network error", true);
  }

  if (!res.ok) {
    throw new IntegrationError("leetcode", `HTTP ${res.status}`, res.status >= 500);
  }

  let json: LeetCodeResponse;
  try {
    json = await res.json() as LeetCodeResponse;
  } catch {
    throw new IntegrationError("leetcode", "Invalid JSON response");
  }

  const user = json.data?.matchedUser;
  if (!user) {
    throw new IntegrationError("leetcode", `User "${handle}" not found`);
  }

  // Total accepted submissions (All difficulties)
  const allAccepted = user.submitStatsGlobal.acSubmissionNum.find(
    (s) => s.difficulty === "All"
  );

  // Top 3 languages by problems solved
  const topLangs = [...user.languageProblemCount]
    .sort((a, b) => b.problemsSolved - a.problemsSolved)
    .slice(0, 3)
    .map((l) => l.languageName);

  return {
    rating: user.profile.ranking > 0 ? user.profile.ranking : undefined,
    solved: allAccepted?.count ?? 0,
    langs: topLangs.length > 0 ? topLangs : undefined,
    syncedAt: new Date().toISOString(),
  };
}
