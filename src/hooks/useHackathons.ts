"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Hackathon, EligibilityScope } from "@/types";
import { useToast } from "@/components/ui/toast-provider";
import type { ParticipationModeFilter, SortOption } from "@/components/hackathons/hackathon-filters";

export type EligibilityScopeFilter = "ALL" | EligibilityScope;
export type StreamTab = "ALL" | "CAMPUS" | "NATIONAL";

export interface HackathonSections {
  featured: Hackathon[];
  closingSoon: Hackathon[];
  localCampus: Hackathon[];
  upcoming: Hackathon[];
  other: Hackathon[];
}

const EMPTY_SECTIONS: HackathonSections = {
  featured: [],
  closingSoon: [],
  localCampus: [],
  upcoming: [],
  other: [],
};

const INITIAL_PAGE_SIZE = 9;
const INCREMENTAL_STEP = 6;

export function useHackathons() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [sections, setSections] = useState<HackathonSections>(EMPTY_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States initialized from URL params
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get("search") || "");
  const [selectedMode, setSelectedMode] = useState<ParticipationModeFilter>(() => {
    const m = searchParams?.get("mode")?.toUpperCase();
    return m === "ONLINE" || m === "OFFLINE" || m === "HYBRID" ? (m as ParticipationModeFilter) : "ALL";
  });
  const [nationalOnly, setNationalOnly] = useState(() => searchParams?.get("nationalOnly") === "true");
  const [openRegOnly, setOpenRegOnly] = useState(() => searchParams?.get("openRegOnly") === "true");
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams?.get("tag") || "All");
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const s = searchParams?.get("sortBy");
    return s === "deadline" || s === "startDate" || s === "prize" ? (s as SortOption) : "ranked";
  });
  // Location & eligibility filters
  const [selectedCollege, setSelectedCollege] = useState<string>(() => searchParams?.get("college") || "ALL");
  const [selectedCity, setSelectedCity] = useState<string>(() => searchParams?.get("city") || "ALL");
  const [selectedEligibility, setSelectedEligibility] = useState<EligibilityScopeFilter>(() => {
    const e = searchParams?.get("eligibility")?.toUpperCase();
    return e === "OPEN_TO_ALL" || e === "ANY_COLLEGE_STUDENT" || e === "HOST_COLLEGE_ONLY"
      ? (e as EligibilityScopeFilter)
      : "ALL";
  });
  // Stream tab state: "ALL" | "CAMPUS" | "NATIONAL"
  const [selectedStream, setSelectedStream] = useState<StreamTab>(() => {
    const s = searchParams?.get("stream")?.toUpperCase();
    return s === "CAMPUS" || s === "NATIONAL" ? (s as StreamTab) : "ALL";
  });

  // Incremental loading state
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  // Synchronize internal filter states when URL query parameters change (e.g. browser back/forward or shared link)
  useEffect(() => {
    if (!searchParams) return;
    const urlCollege = searchParams.get("college") || "ALL";
    const urlCity = searchParams.get("city") || "ALL";
    const urlMode = searchParams.get("mode")?.toUpperCase();
    const validMode = urlMode === "ONLINE" || urlMode === "OFFLINE" || urlMode === "HYBRID" ? urlMode : "ALL";
    const urlOpenReg = searchParams.get("openRegOnly") === "true";
    const urlNational = searchParams.get("nationalOnly") === "true";
    const urlSearch = searchParams.get("search") || "";
    const urlTag = searchParams.get("tag") || "All";
    const urlSort = searchParams.get("sortBy");
    const validSort = urlSort === "deadline" || urlSort === "startDate" || urlSort === "prize" ? urlSort : "ranked";
    const urlElig = searchParams.get("eligibility")?.toUpperCase();
    const validElig = urlElig === "OPEN_TO_ALL" || urlElig === "ANY_COLLEGE_STUDENT" || urlElig === "HOST_COLLEGE_ONLY" ? urlElig : "ALL";
    const urlStream = searchParams.get("stream")?.toUpperCase();
    const validStream = urlStream === "CAMPUS" || urlStream === "NATIONAL" ? urlStream : "ALL";

    setSelectedCollege((prev) => (prev !== urlCollege ? urlCollege : prev));
    setSelectedCity((prev) => (prev !== urlCity ? urlCity : prev));
    setSelectedMode((prev) => (prev !== validMode ? (validMode as ParticipationModeFilter) : prev));
    setOpenRegOnly((prev) => (prev !== urlOpenReg ? urlOpenReg : prev));
    setNationalOnly((prev) => (prev !== urlNational ? urlNational : prev));
    setSearchQuery((prev) => (prev !== urlSearch ? urlSearch : prev));
    setSelectedCategory((prev) => (prev !== urlTag ? urlTag : prev));
    setSortBy((prev) => (prev !== validSort ? (validSort as SortOption) : prev));
    setSelectedEligibility((prev) => (prev !== validElig ? (validElig as EligibilityScopeFilter) : prev));
    setSelectedStream((prev) => (prev !== validStream ? (validStream as StreamTab) : prev));
  }, [searchParams]);

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
      if (selectedCollege !== "ALL") params.set("college", selectedCollege);
      if (selectedCity !== "ALL") params.set("city", selectedCity);
      if (selectedEligibility !== "ALL") params.set("eligibility", selectedEligibility);
      if (openRegOnly) params.set("openRegOnly", "true");
      if (sortBy !== "ranked") params.set("sortBy", sortBy);

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
          localCampus: data.sections.localCampus || [],
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
  }, [searchQuery, selectedMode, nationalOnly, selectedCategory, selectedCollege, selectedCity, selectedEligibility, openRegOnly, sortBy, toast]);

  useEffect(() => {
    fetchRankedHackathons();
  }, [fetchRankedHackathons]);

  // Flatten all unique items from sections, strictly excluding ended or cancelled events
  const allActiveHackathons = useMemo(() => {
    const map = new Map<string, Hackathon>();
    const combine = [
      ...sections.featured,
      ...sections.closingSoon,
      ...(sections.localCampus || []),
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

        // Enforce eligibility scope filter
        if (selectedEligibility !== "ALL" && h.eligibilityScope !== selectedEligibility) {
          return false;
        }

        // Enforce college filter client-side (slug or name)
        if (selectedCollege !== "ALL") {
          const slug = (h.collegeSlug ?? "").toLowerCase();
          const name = (h.collegeName ?? "").toLowerCase();
          const filter = selectedCollege.toLowerCase();
          if (!slug.includes(filter) && !name.includes(filter)) {
            return false;
          }
        }

        // Enforce city filter client-side
        if (selectedCity !== "ALL") {
          const hCity = (h.city ?? "").toLowerCase();
          if (!hCity.includes(selectedCity.toLowerCase())) {
            return false;
          }
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
    selectedCollege,
    selectedCity,
    selectedEligibility,
  ]);

  // Is this the default discovery view where we show the 4 curated sections?
  const isCuratedSectionsView = useMemo(() => {
    return (
      sortBy === "ranked" &&
      !searchQuery.trim() &&
      selectedCategory === "All" &&
      selectedMode === "ALL" &&
      !nationalOnly &&
      !openRegOnly &&
      selectedCollege === "ALL" &&
      selectedCity === "ALL" &&
      selectedEligibility === "ALL"
    );
  }, [sortBy, searchQuery, selectedCategory, selectedMode, nationalOnly, openRegOnly, selectedCollege, selectedCity, selectedEligibility]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      selectedCategory !== "All" ||
      selectedMode !== "ALL" ||
      nationalOnly ||
      openRegOnly ||
      selectedCollege !== "ALL" ||
      selectedCity !== "ALL" ||
      selectedEligibility !== "ALL" ||
      selectedStream !== "ALL" ||
      sortBy !== "ranked"
  );

  // Two-way synchronization: update URL search parameters when filters change
  useEffect(() => {
    if (!router || !pathname) return;
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (selectedMode !== "ALL") params.set("mode", selectedMode);
    if (nationalOnly) params.set("nationalOnly", "true");
    if (openRegOnly) params.set("openRegOnly", "true");
    if (selectedCategory !== "All") params.set("tag", selectedCategory);
    if (sortBy !== "ranked") params.set("sortBy", sortBy);
    if (selectedCollege !== "ALL") params.set("college", selectedCollege);
    if (selectedCity !== "ALL") params.set("city", selectedCity);
    if (selectedEligibility !== "ALL") params.set("eligibility", selectedEligibility);
    if (selectedStream !== "ALL") params.set("stream", selectedStream.toLowerCase());

    const newQuery = params.toString();
    const basePath = pathname || "/hackathons";
    const newUrl = newQuery ? `/hackathons?${newQuery}` : basePath;
    const currentQuery = searchParams?.toString() ?? "";
    const currentUrl = currentQuery ? `/hackathons?${currentQuery}` : basePath;

    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [
    searchQuery,
    selectedMode,
    nationalOnly,
    openRegOnly,
    selectedCategory,
    sortBy,
    selectedCollege,
    selectedCity,
    selectedEligibility,
    selectedStream,
    pathname,
    router,
    searchParams,
  ]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedMode("ALL");
    setNationalOnly(false);
    setOpenRegOnly(false);
    setSelectedCollege("ALL");
    setSelectedCity("ALL");
    setSelectedEligibility("ALL");
    setSelectedStream("ALL");
    setSortBy("ranked");
    setVisibleCount(INITIAL_PAGE_SIZE);
    if (router) {
      router.replace("/hackathons", { scroll: false });
    }
  }, [router]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + INCREMENTAL_STEP);
  }, []);

  // Partition active hackathons into distinct streams
  const localCampusHackathons = useMemo(() => {
    return filteredHackathons.filter(
      (h) =>
        h.isCommunitySubmitted === true ||
        h.stream === "COMMUNITY_LOCAL" ||
        Boolean(h.collegeSlug || h.collegeName)
    );
  }, [filteredHackathons]);

  const nationalHackathons = useMemo(() => {
    return filteredHackathons.filter(
      (h) =>
        h.stream === "NATIONAL_AUTOMATED" ||
        (h.isNational === true && !h.isCommunitySubmitted)
    );
  }, [filteredHackathons]);

  // Items currently visible for incremental loading
  const visibleHackathons = useMemo(() => {
    return filteredHackathons.slice(0, visibleCount);
  }, [filteredHackathons, visibleCount]);

  const hasMore = visibleCount < filteredHackathons.length;

  return {
    sections,
    allHackathons: allActiveHackathons,
    hackathons: filteredHackathons,
    localCampusHackathons,
    nationalHackathons,
    selectedStream,
    setSelectedStream,
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
    // Location & eligibility
    selectedCollege,
    setSelectedCollege,
    selectedCity,
    setSelectedCity,
    selectedEligibility,
    setSelectedEligibility,
    resetFilters,
    refresh: fetchRankedHackathons,
    // Compatibility aliases
    category: selectedCategory,
    setCategory: setSelectedCategory,
  };
}
