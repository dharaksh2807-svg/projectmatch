"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Hackathon } from "@/types";
import { useToast } from "@/components/ui/toast-provider";
import type { ParticipationModeFilter, SortOption } from "@/components/hackathons/hackathon-filters";

export interface HackathonSections {
  featured: Hackathon[];
  closingSoon: Hackathon[];
  upcoming: Hackathon[];
  other: Hackathon[];
}

const EMPTY_SECTIONS: HackathonSections = {
  featured: [],
  closingSoon: [],
  upcoming: [],
  other: [],
};

const INITIAL_PAGE_SIZE = 9;
const INCREMENTAL_STEP = 6;

export function useHackathons() {
  const { toast } = useToast();

  const [sections, setSections] = useState<HackathonSections>(EMPTY_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<ParticipationModeFilter>("ALL");
  const [nationalOnly, setNationalOnly] = useState(false);
  const [openRegOnly, setOpenRegOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("ranked");

  // Incremental loading state
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  /**
   * Fetch ranked hackathon sections from the database-backed API.
   * Ensures completed (PAST) and CANCELLED events are never fetched or displayed.
   */
  const fetchRankedHackathons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API query parameters
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (selectedMode !== "ALL") params.set("mode", selectedMode);
      if (nationalOnly) params.set("nationalOnly", "true");
      if (selectedCategory !== "All") params.set("tag", selectedCategory);

      const url = `/api/hackathons/ranked?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.sections) {
        setSections({
          featured: data.sections.featured || [],
          closingSoon: data.sections.closingSoon || [],
          upcoming: data.sections.upcoming || [],
          other: data.sections.other || [],
        });
      } else {
        setSections(EMPTY_SECTIONS);
      }
    } catch (err: any) {
      console.error("Failed to load ranked hackathons:", err);
      const msg = err?.message || "Failed to load hackathons from database";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedMode, nationalOnly, selectedCategory, toast]);

  useEffect(() => {
    fetchRankedHackathons();
  }, [fetchRankedHackathons]);

  // Flatten all unique items from sections, strictly excluding ended or cancelled events
  const allActiveHackathons = useMemo(() => {
    const map = new Map<string, Hackathon>();
    const combine = [
      ...sections.featured,
      ...sections.closingSoon,
      ...sections.upcoming,
      ...sections.other,
    ];

    for (const h of combine) {
      if (!h || !h.id) continue;
      // Invariant: NEVER include completed or cancelled events
      const compStatus = (h.computedStatus || h.status || "").toUpperCase();
      if (compStatus === "ENDED" || compStatus === "COMPLETED" || compStatus === "CANCELLED") {
        continue;
      }
      if (!map.has(h.id)) {
        map.set(h.id, h);
      }
    }
    return Array.from(map.values());
  }, [sections]);

  // Client-side filtering & sorting refinement (instant UI reactivity)
  const filteredHackathons = useMemo(() => {
    return allActiveHackathons
      .filter((h) => {
        // Enforce national filter if toggled
        if (nationalOnly && !h.isNational) {
          return false;
        }

        // Enforce open registration filter if toggled
        if (openRegOnly) {
          const regStatus = (h.computedRegistrationStatus || h.registrationStatus || "").toUpperCase();
          if (regStatus !== "OPEN") return false;
        }

        // Mode filter
        if (selectedMode !== "ALL") {
          const mode = (h.participationMode || "").toUpperCase();
          if (selectedMode === "ONLINE" && mode !== "ONLINE") return false;
          if (selectedMode === "OFFLINE" && mode !== "OFFLINE") return false;
          if (selectedMode === "HYBRID" && mode !== "HYBRID") return false;
        }

        // Category filter
        if (selectedCategory !== "All") {
          const catLower = selectedCategory.toLowerCase();
          const allText = [
            h.name,
            h.description || "",
            ...(h.tags || []),
            ...(h.themes || []),
          ]
            .join(" ")
            .toLowerCase();

          if (selectedCategory === "AI & ML") {
            if (!allText.includes("ai") && !allText.includes("ml") && !allText.includes("genai")) return false;
          } else if (selectedCategory === "Web3") {
            if (!allText.includes("web3") && !allText.includes("crypto") && !allText.includes("blockchain") && !allText.includes("eth")) return false;
          } else if (!allText.includes(catLower)) {
            return false;
          }
        }

        // Text search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matches =
            h.name.toLowerCase().includes(q) ||
            (h.description && h.description.toLowerCase().includes(q)) ||
            (h.organizerName && h.organizerName.toLowerCase().includes(q)) ||
            (h.location && h.location.toLowerCase().includes(q)) ||
            (h.city && h.city.toLowerCase().includes(q)) ||
            (h.country && h.country.toLowerCase().includes(q)) ||
            (h.tags && h.tags.some((t) => t.toLowerCase().includes(q))) ||
            (h.themes && h.themes.some((t) => t.toLowerCase().includes(q)));

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "deadline") {
          // Sort by registration deadline (soonest first; items with no deadline at the end)
          const dateA = a.registrationDeadline ? new Date(a.registrationDeadline).getTime() : Infinity;
          const dateB = b.registrationDeadline ? new Date(b.registrationDeadline).getTime() : Infinity;
          return dateA - dateB;
        }

        if (sortBy === "startDate") {
          // Sort by event start date (soonest first)
          const dateA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
          return dateA - dateB;
        }

        if (sortBy === "prize") {
          // Sort by prize amount descending
          const prizeA = a.prizeAmount || 0;
          const prizeB = b.prizeAmount || 0;
          return prizeB - prizeA;
        }

        // Default: priority ranked by rankScore
        const scoreA = a.rankScore?.total ?? 0;
        const scoreB = b.rankScore?.total ?? 0;
        return scoreB - scoreA;
      });
  }, [
    allActiveHackathons,
    nationalOnly,
    openRegOnly,
    selectedMode,
    selectedCategory,
    searchQuery,
    sortBy,
  ]);

  // Is this the default discovery view where we show the 4 curated sections?
  const isCuratedSectionsView = useMemo(() => {
    return (
      sortBy === "ranked" &&
      !searchQuery.trim() &&
      selectedCategory === "All" &&
      selectedMode === "ALL" &&
      !nationalOnly &&
      !openRegOnly
    );
  }, [sortBy, searchQuery, selectedCategory, selectedMode, nationalOnly, openRegOnly]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      selectedCategory !== "All" ||
      selectedMode !== "ALL" ||
      nationalOnly ||
      openRegOnly ||
      sortBy !== "ranked"
  );

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedMode("ALL");
    setNationalOnly(false);
    setOpenRegOnly(false);
    setSortBy("ranked");
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + INCREMENTAL_STEP);
  }, []);

  // Items currently visible for incremental loading
  const visibleHackathons = useMemo(() => {
    return filteredHackathons.slice(0, visibleCount);
  }, [filteredHackathons, visibleCount]);

  const hasMore = visibleCount < filteredHackathons.length;

  return {
    sections,
    allHackathons: allActiveHackathons,
    hackathons: filteredHackathons,
    visibleHackathons,
    visibleCount,
    hasMore,
    loadMore,
    loading,
    error,
    isCuratedSectionsView,
    hasActiveFilters,
    // Filters & Setters
    searchQuery,
    setSearchQuery,
    selectedMode,
    setSelectedMode,
    nationalOnly,
    setNationalOnly,
    openRegOnly,
    setOpenRegOnly,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    resetFilters,
    refresh: fetchRankedHackathons,
    // Compatibility aliases
    category: selectedCategory,
    setCategory: setSelectedCategory,
  };
}
