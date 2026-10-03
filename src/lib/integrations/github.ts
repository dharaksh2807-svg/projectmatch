import { CompressedMetadata, IntegrationError } from "./types";

const GITHUB_API = "https://api.github.com/users";

interface GitHubUserResponse {
  public_repos: number;
  followers: number;
}

export async function fetchGithub(handle: string): Promise<CompressedMetadata> {
  let res: Response;
  try {
    res = await fetch(`${GITHUB_API}/${encodeURIComponent(handle)}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new IntegrationError("github", "Request timed out or network error", true);
  }

  if (!res.ok) {
    if (res.status === 403) {
      // Rate limit exceeded for unauthenticated requests
      throw new IntegrationError("github", "GitHub API rate limit exceeded. Try again later.", true);
    }
    throw new IntegrationError("github", `HTTP ${res.status}`, res.status >= 500);
  }

  let json: GitHubUserResponse;
  try {
    json = await res.json() as GitHubUserResponse;
  } catch {
    throw new IntegrationError("github", "Invalid JSON from GitHub API");
  }

  return {
    notebooks: json.public_repos, // Mapping repos to notebooks for compression
    rating: json.followers,       // Mapping followers to rating
    syncedAt: new Date().toISOString(),
  };
}
