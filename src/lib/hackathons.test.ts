import { describe, it, expect } from "vitest";

interface SimpleHackathon {
  name: string;
  description: string;
  location: string;
}

function filterHackathons(
  hackathons: SimpleHackathon[],
  searchQuery: string,
  category: string
) {
  return hackathons.filter((h) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      h.name.toLowerCase().includes(q) ||
      h.description.toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (category === "Virtual") {
      return (
        h.location.toLowerCase().includes("virtual") ||
        h.location.toLowerCase().includes("online")
      );
    }
    if (category === "In-Person") {
      return (
        !h.location.toLowerCase().includes("virtual") &&
        !h.location.toLowerCase().includes("online")
      );
    }
    if (category === "AI & ML") {
      return (
        h.name.toLowerCase().includes("ai") ||
        h.name.toLowerCase().includes("genai") ||
        h.description.toLowerCase().includes("ai")
      );
    }
    if (category === "Web3") {
      return (
        h.name.toLowerCase().includes("eth") ||
        h.name.toLowerCase().includes("crypto") ||
        h.description.toLowerCase().includes("decentralized")
      );
    }

    return true;
  });
}

const mockHackathons: SimpleHackathon[] = [
  {
    name: "Google Cloud GenAI Hackathon 2026",
    description: "Build cutting-edge multi-agent systems using Gemini 3.1",
    location: "Global Virtual",
  },
  {
    name: "CalHacks 12.0",
    description: "The world's largest collegiate hackathon hosted at UC Berkeley",
    location: "San Francisco, CA & Hybrid",
  },
  {
    name: "ETHGlobal San Francisco",
    description: "Decentralized protocol and Web3 builder sprint",
    location: "San Francisco, CA",
  },
  {
    name: "AI Agents Global Sprint",
    description: "Autonomous LLM systems hackathon",
    location: "Virtual (Discord)",
  },
];

describe("filterHackathons", () => {
  it("returns all hackathons when query is empty and category is All", () => {
    const result = filterHackathons(mockHackathons, "", "All");
    expect(result).toHaveLength(4);
  });

  it("filters accurately by text search query", () => {
    const result = filterHackathons(mockHackathons, "Berkeley", "All");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("CalHacks 12.0");
  });

  it("filters virtual hackathons", () => {
    const result = filterHackathons(mockHackathons, "", "Virtual");
    expect(result).toHaveLength(2);
    expect(result.every((h) => h.location.toLowerCase().includes("virtual"))).toBe(true);
  });

  it("filters Web3 hackathons", () => {
    const result = filterHackathons(mockHackathons, "", "Web3");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("ETHGlobal San Francisco");
  });

  it("filters AI & ML hackathons", () => {
    const result = filterHackathons(mockHackathons, "", "AI & ML");
    expect(result).toHaveLength(2);
  });
});
