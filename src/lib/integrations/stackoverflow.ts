import { CompressedMetadata, IntegrationError } from "./types";

// Official StackExchange API — no auth required for public data.
const SO_BASE = "https://api.stackexchange.com/2.3";

interface SOUserResponse {
  items?: {
    reputation: number;
    badge_counts: {
      bronze: number;
      silver: number;
      gold: number;
    };
  }[];
}

export async function fetchStackOverflow(handle: string): Promise<CompressedMetadata> {
  let res: Response;

  try {
    // StackOverflow API doesn't support exact username match without knowing the user ID,
    // but we can search for the display name and take the best match.
    // For exact handle matching via inname, we use the first item returned.
    res = await fetch(`${SO_BASE}/users?order=desc&sort=reputation&inname=${encodeURIComponent(handle)}&site=stackoverflow`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new IntegrationError("stackoverflow", "Request timed out or network error", true);
  }

  if (!res.ok) {
    throw new IntegrationError("stackoverflow", `HTTP ${res.status}`, res.status >= 500);
  }

  let json: SOUserResponse;
  try {
    json = await res.json() as SOUserResponse;
  } catch {
    throw new IntegrationError("stackoverflow", "Invalid JSON from StackOverflow API");
  }

  if (!json.items || json.items.length === 0) {
    throw new IntegrationError(
      "stackoverflow",
      `User "${handle}" not found`
    );
  }

  const user = json.items[0];

  const totalBadges = 
    (user.badge_counts?.gold || 0) + 
    (user.badge_counts?.silver || 0) + 
    (user.badge_counts?.bronze || 0);

  return {
    rating: user.reputation, // We store reputation in the 'rating' field for compression
    medals: totalBadges,
    syncedAt: new Date().toISOString(),
  };
}
