"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  Sparkles,
  Clock,
  RotateCcw,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  Loader2,
  Send,
  Heart,
  X,
  Compass,
  MessageSquare,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextualChatDrawer,
  type ContextualChatContext,
} from "@/components/chat/contextual-chat-drawer";
import { ApplyModal } from "@/components/applications/apply-modal";
import {
  AdvancedFiltersDrawer,
  type AvailableHackathon,
} from "@/components/discover/advanced-filters-drawer";
import {
  ROLE_CATEGORIES,
  STANDARD_SKILLS,
} from "@/lib/filters/normalize";

interface MatchedRole {
  id: string;
  title: string;
  description?: string | null;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  openSpots: number;
  isApplied?: boolean;
  isBookmarked?: boolean;
  project: {
    id: string;
    title: string;
    description: string;
    projectType: string;
    duration: string;
    techStack: string[];
    ownerId: string;
    hackathonId?: string | null;
    hackathon?: {
      id: string;
      name: string;
      participationMode?: string | null;
      status?: string | null;
      registrationStatus?: string | null;
      city?: string | null;
      collegeName?: string | null;
      tags?: string[];
    } | null;
    owner: {
      name: string | null;
      image: string | null;
      reputationScore?: number;
      city?: string | null;
      collegeName?: string | null;
    };
  };
  compatibility?: {
    score: number;
    factorsMatched: number;
    totalFactors: number;
    hasActiveFilters?: boolean;
    breakdown: {
      skillOverlap: number;
      techOverlap?: number;
      typeFit?: number;
      durationFit?: number;
      experienceFit: number;
    };
  };
}

const PROJECT_TYPES = [
  "All",
  "Hackathon",
  "Startup",
  "Open Source",
  "Side Project",
  "Research",
  "Competition",
];

const EXPERIENCE_LEVELS: { label: string; value: string }[] = [
  { label: "All Levels", value: "All" },
  { label: "Beginner", value: "Beginner" },
  { label: "Intermediate", value: "Intermediate" },
  { label: "Advanced", value: "Advanced" },
  { label: "Expert", value: "Expert" },
  { label: "Any Level", value: "Any" },
];

const SORT_OPTIONS = [
  { label: "Best Match", value: "match" },
  { label: "Newest First", value: "newest" },
  { label: "Most Open Spots", value: "spots" },
  { label: "Role Title (A–Z)", value: "title" },
  { label: "Hackathon Deadline", value: "deadline" },
];

function DiscoverContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const isGuest = status === "unauthenticated";
  const { toast } = useToast();

  const [roles, setRoles] = useState<MatchedRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);

  // ─── Filter States (Hydrated from URL parameters) ─────────────────────────
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [selectedType, setSelectedType] = useState(() => searchParams.get("type") || "All");
  const [selectedRoleCategory, setSelectedRoleCategory] = useState(
    () => searchParams.get("role") || "All"
  );
  const [selectedExp, setSelectedExp] = useState(() => searchParams.get("exp") || "All");
  const [selectedDuration, setSelectedDuration] = useState(
    () => searchParams.get("duration") || "All"
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() => {
    const raw = searchParams.getAll("skill");
    return raw.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  });
  const [skillMode, setSkillMode] = useState<"any" | "all">(() =>
    searchParams.get("skillMode") === "all" ? "all" : "any"
  );
  const [selectedTechs, setSelectedTechs] = useState<string[]>(() => {
    const raw = searchParams.getAll("tech");
    return raw.flatMap((t) => t.split(",")).map((t) => t.trim()).filter(Boolean);
  });
  const [techMode, setTechMode] = useState<"any" | "all">(() =>
    searchParams.get("techMode") === "all" ? "all" : "any"
  );

  // Hackathon filters
  const [selectedHackathonId, setSelectedHackathonId] = useState(
    () => searchParams.get("hackathonId") || "All"
  );
  const [selectedMode, setSelectedMode] = useState(
    () => searchParams.get("mode") || "ALL"
  );
  const [selectedTrack, setSelectedTrack] = useState(
    () => searchParams.get("track") || "All"
  );
  const [openRegOnly, setOpenRegOnly] = useState(
    () => searchParams.get("openRegOnly") === "true"
  );
  const [selectedCollege, setSelectedCollege] = useState(
    () => searchParams.get("college") || "ALL"
  );

  // Recruitment filters
  const [minSpots, setMinSpots] = useState(() =>
    parseInt(searchParams.get("minSpots") || "0", 10)
  );
  const [selectedCommitment, setSelectedCommitment] = useState(
    () => searchParams.get("commitment") || "All"
  );
  const [beginnerFriendly, setBeginnerFriendly] = useState(
    () => searchParams.get("beginnerFriendly") === "true"
  );
  const [openOnly, setOpenOnly] = useState(
    () => searchParams.get("openOnly") === "true"
  );
  const [hideApplied, setHideApplied] = useState(
    () => searchParams.get("hideApplied") === "true"
  );
  const [bookmarkedOnly, setBookmarkedOnly] = useState(
    () => searchParams.get("bookmarkedOnly") === "true"
  );
  const [minScore, setMinScore] = useState(() =>
    parseInt(searchParams.get("minScore") || "0", 10)
  );
  const [sortBy, setSortBy] = useState(() => searchParams.get("sort") || "match");

  // Metadata from backend
  const [availableTechs, setAvailableTechs] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<string[]>(STANDARD_SKILLS);
  const [availableHackathons, setAvailableHackathons] = useState<AvailableHackathon[]>([]);

  // Advanced Filters Drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Contextual Chat Drawer state
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [activeChatContext, setActiveChatContext] = useState<ContextualChatContext | null>(null);

  // Ref to prevent duplicate initial fetches & track requests
  const requestIdRef = useRef(0);

  const handleOpenChat = (chatContext: ContextualChatContext) => {
    if (isGuest) {
      window.location.href = "/login?callbackUrl=/discover";
      return;
    }
    setActiveChatContext(chatContext);
    setChatDrawerOpen(true);
  };

  // Adjust default sort for guests
  useEffect(() => {
    if (isGuest && sortBy === "match") {
      setSortBy("newest");
    }
  }, [isGuest, sortBy]);

  // ─── URL Query Parameter Serialization ────────────────────────────────────
  const syncUrlParams = useCallback(() => {
    const params = new URLSearchParams();

    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (selectedType !== "All") params.set("type", selectedType);
    if (selectedRoleCategory !== "All") params.set("role", selectedRoleCategory);
    if (selectedExp !== "All") params.set("exp", selectedExp);
    if (selectedDuration !== "All") params.set("duration", selectedDuration);

    if (selectedSkills.length > 0) {
      selectedSkills.forEach((s) => params.append("skill", s));
      if (skillMode === "all") params.set("skillMode", "all");
    }

    if (selectedTechs.length > 0) {
      selectedTechs.forEach((t) => params.append("tech", t));
      if (techMode === "all") params.set("techMode", "all");
    }

    if (selectedHackathonId !== "All") params.set("hackathonId", selectedHackathonId);
    if (selectedMode !== "ALL") params.set("mode", selectedMode);
    if (selectedTrack !== "All") params.set("track", selectedTrack);
    if (openRegOnly) params.set("openRegOnly", "true");
    if (selectedCollege !== "ALL") params.set("college", selectedCollege);

    if (minSpots > 0) params.set("minSpots", minSpots.toString());
    if (selectedCommitment !== "All") params.set("commitment", selectedCommitment);
    if (beginnerFriendly) params.set("beginnerFriendly", "true");
    if (openOnly) params.set("openOnly", "true");
    if (hideApplied) params.set("hideApplied", "true");
    if (bookmarkedOnly) params.set("bookmarkedOnly", "true");
    if (minScore > 0) params.set("minScore", minScore.toString());
    if (sortBy && sortBy !== "match") params.set("sort", sortBy);

    const queryStr = params.toString();
    const targetUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
    window.history.replaceState(null, "", targetUrl);
  }, [
    searchQuery,
    selectedType,
    selectedRoleCategory,
    selectedExp,
    selectedDuration,
    selectedSkills,
    skillMode,
    selectedTechs,
    techMode,
    selectedHackathonId,
    selectedMode,
    selectedTrack,
    openRegOnly,
    selectedCollege,
    minSpots,
    selectedCommitment,
    beginnerFriendly,
    openOnly,
    hideApplied,
    bookmarkedOnly,
    minScore,
    sortBy,
    pathname,
  ]);

  // Sync to URL whenever state changes
  useEffect(() => {
    syncUrlParams();
  }, [syncUrlParams]);

  // ─── Toggles & Helpers ────────────────────────────────────────────────────
  const toggleTech = (tech: string) => {
    setSelectedTechs((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedType("All");
    setSelectedRoleCategory("All");
    setSelectedExp("All");
    setSelectedDuration("All");
    setSelectedSkills([]);
    setSkillMode("any");
    setSelectedTechs([]);
    setTechMode("any");
    setSelectedHackathonId("All");
    setSelectedMode("ALL");
    setSelectedTrack("All");
    setOpenRegOnly(false);
    setSelectedCollege("ALL");
    setMinSpots(0);
    setSelectedCommitment("All");
    setBeginnerFriendly(false);
    setOpenOnly(false);
    setHideApplied(false);
    setBookmarkedOnly(false);
    setMinScore(0);
    setSortBy(isGuest ? "newest" : "match");
  };

  // ─── Fetch Roles Function ─────────────────────────────────────────────────
  const fetchRoles = useCallback(
    async (isLoadMore = false, cursorToUse?: string | null) => {
      const currentRequestId = ++requestIdRef.current;

      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const queryParams = new URLSearchParams();
        if (searchQuery.trim()) queryParams.append("q", searchQuery.trim());
        if (selectedType !== "All") queryParams.append("type", selectedType);
        if (selectedRoleCategory !== "All") queryParams.append("role", selectedRoleCategory);
        if (selectedExp !== "All") queryParams.append("exp", selectedExp);
        if (selectedDuration !== "All") queryParams.append("duration", selectedDuration);

        if (selectedSkills.length > 0) {
          selectedSkills.forEach((s) => queryParams.append("skill", s));
          if (skillMode === "all") queryParams.append("skillMode", "all");
        }

        if (selectedTechs.length > 0) {
          selectedTechs.forEach((t) => queryParams.append("tech", t));
          if (techMode === "all") queryParams.append("techMode", "all");
        }

        if (selectedHackathonId !== "All") queryParams.append("hackathonId", selectedHackathonId);
        if (selectedMode !== "ALL") queryParams.append("mode", selectedMode);
        if (selectedTrack !== "All") queryParams.append("track", selectedTrack);
        if (openRegOnly) queryParams.append("openRegOnly", "true");
        if (selectedCollege !== "ALL") queryParams.append("college", selectedCollege);

        if (minSpots > 0) queryParams.append("minSpots", minSpots.toString());
        if (selectedCommitment !== "All") queryParams.append("commitment", selectedCommitment);
        if (beginnerFriendly) queryParams.append("beginnerFriendly", "true");
        if (openOnly) queryParams.append("openOnly", "true");
        if (hideApplied) queryParams.append("hideApplied", "true");
        if (bookmarkedOnly) queryParams.append("bookmarkedOnly", "true");
        if (minScore > 0) queryParams.append("minScore", minScore.toString());
        if (sortBy) queryParams.append("sort", sortBy);

        queryParams.append("limit", "12");
        if (isLoadMore && cursorToUse) {
          queryParams.append("cursor", cursorToUse);
        }

        const res = await fetch(`/api/matches/roles?${queryParams.toString()}`);
        if (res.ok) {
          // Ignore stale responses
          if (currentRequestId !== requestIdRef.current) return;

          const data = await res.json();
          const fetchedResults: MatchedRole[] = data.results || [];

          if (isLoadMore) {
            setRoles((prev) => [...prev, ...fetchedResults]);
          } else {
            setRoles(fetchedResults);
          }

          setNextCursor(data.nextCursor || null);
          setHasMore(Boolean(data.hasMore));
          setTotalCount(data.totalAvailable ?? fetchedResults.length);

          if (data.allUniqueTechs && data.allUniqueTechs.length > 0) {
            setAvailableTechs(data.allUniqueTechs);
          }
          if (data.allUniqueSkills && data.allUniqueSkills.length > 0) {
            setAvailableSkills(data.allUniqueSkills);
          }
          if (data.availableHackathons && data.availableHackathons.length > 0) {
            setAvailableHackathons(data.availableHackathons);
          }
        }
      } catch (err) {
        console.error("Failed to fetch roles:", err);
        toast("Failed to load roles. Please try again.", "error");
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      searchQuery,
      selectedType,
      selectedRoleCategory,
      selectedExp,
      selectedDuration,
      selectedSkills,
      skillMode,
      selectedTechs,
      techMode,
      selectedHackathonId,
      selectedMode,
      selectedTrack,
      openRegOnly,
      selectedCollege,
      minSpots,
      selectedCommitment,
      beginnerFriendly,
      openOnly,
      hideApplied,
      bookmarkedOnly,
      minScore,
      sortBy,
      toast,
    ]
  );

  // Debounced fetch on filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  // ─── Active Filter Calculation ────────────────────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedType !== "All") count++;
    if (selectedRoleCategory !== "All") count++;
    if (selectedExp !== "All") count++;
    if (selectedDuration !== "All") count++;
    if (selectedSkills.length > 0) count += selectedSkills.length;
    if (selectedTechs.length > 0) count += selectedTechs.length;
    if (selectedHackathonId !== "All") count++;
    if (selectedMode !== "ALL") count++;
    if (selectedTrack !== "All") count++;
    if (openRegOnly) count++;
    if (selectedCollege !== "ALL") count++;
    if (minSpots > 0) count++;
    if (selectedCommitment !== "All") count++;
    if (beginnerFriendly) count++;
    if (openOnly) count++;
    if (hideApplied) count++;
    if (bookmarkedOnly) count++;
    if (minScore > 0) count++;
    return count;
  }, [
    searchQuery,
    selectedType,
    selectedRoleCategory,
    selectedExp,
    selectedDuration,
    selectedSkills,
    selectedTechs,
    selectedHackathonId,
    selectedMode,
    selectedTrack,
    openRegOnly,
    selectedCollege,
    minSpots,
    selectedCommitment,
    beginnerFriendly,
    openOnly,
    hideApplied,
    bookmarkedOnly,
    minScore,
  ]);

  // Bookmark Toggle
  const handleToggleBookmark = async (roleId: string, currentBookmarked: boolean) => {
    if (!currentUserId) {
      toast("Please sign in to bookmark roles.", "info");
      return;
    }

    setRoles((prev) =>
      prev.map((r) =>
        r.id === roleId ? { ...r, isBookmarked: !currentBookmarked } : r
      )
    );

    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast(
          data.bookmarked ? "Role saved to bookmarks" : "Role removed from bookmarks",
          "success"
        );
      } else {
        setRoles((prev) =>
          prev.map((r) =>
            r.id === roleId ? { ...r, isBookmarked: currentBookmarked } : r
          )
        );
        toast("Failed to update bookmark.", "error");
      }
    } catch {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === roleId ? { ...r, isBookmarked: currentBookmarked } : r
        )
      );
      toast("Network error. Please try again.", "error");
    }
  };

  const handleRoleApplied = (roleId: string) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, isApplied: true } : r))
    );
  };

  // Selected Hackathon Name helper
  const selectedHackathonName = useMemo(() => {
    if (selectedHackathonId === "All") return "";
    const found = availableHackathons.find((h) => h.id === selectedHackathonId);
    return found ? found.name : "Event";
  }, [selectedHackathonId, availableHackathons]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans min-w-0">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Discover Opportunities
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Browse hackathon teams, startup projects, and open vacancies with intelligent multi-factor matching.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!isGuest && (
            <Button
              variant={bookmarkedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              className="gap-1.5 h-9"
            >
              <Heart
                className={cn(
                  "w-3.5 h-3.5",
                  bookmarkedOnly ? "fill-current text-primary-foreground" : "text-muted-foreground"
                )}
              />
              <span>{bookmarkedOnly ? "Saved Only" : "Bookmarks"}</span>
            </Button>
          )}

          <Link href="/projects/new">
            <Button size="sm" className="gap-1.5 h-9 font-semibold shadow-xs">
              Post a Project
            </Button>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. HORIZONTAL SEARCH & QUICK FILTERS CONTROL BAR
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles, technologies, projects, or hackathons..."
            className="pl-9 pr-8 h-10 text-sm rounded-xl border-input bg-card focus-visible:ring-primary"
            aria-label="Search roles and projects"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Project Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-10 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:bg-secondary/50 transition-colors"
            aria-label="Filter by project type"
          >
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "All" ? "All Types" : type}
              </option>
            ))}
          </select>

          {/* Role Category */}
          <select
            value={selectedRoleCategory}
            onChange={(e) => setSelectedRoleCategory(e.target.value)}
            className="h-10 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:bg-secondary/50 transition-colors"
            aria-label="Filter by role category"
          >
            {ROLE_CATEGORIES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          {/* Experience Level */}
          <select
            value={selectedExp}
            onChange={(e) => setSelectedExp(e.target.value)}
            className="h-10 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:bg-secondary/50 transition-colors"
            aria-label="Filter by experience level"
          >
            {EXPERIENCE_LEVELS.map((exp) => (
              <option key={exp.value} value={exp.value}>
                {exp.label}
              </option>
            ))}
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:bg-secondary/50 transition-colors"
            aria-label="Sort roles"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Advanced Filters Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDrawerOpen(true)}
            className={cn(
              "gap-1.5 h-10 px-3 rounded-xl text-xs font-medium transition-colors",
              activeFiltersCount > 0 && "border-primary/50 bg-primary/5 text-primary"
            )}
            aria-label="Open advanced discovery filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-10 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5 rounded-xl"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. ACTIVE FILTER CHIPS (WITH INDIVIDUAL REMOVAL)
          ───────────────────────────────────────────────────────────── */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground mr-1">Active filters:</span>

          {searchQuery && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Query: "{searchQuery}"</span>
              <button
                onClick={() => setSearchQuery("")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove search query filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedType !== "All" && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Type: {selectedType}</span>
              <button
                onClick={() => setSelectedType("All")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove project type filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedRoleCategory !== "All" && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>
                Role: {ROLE_CATEGORIES.find((r) => r.value === selectedRoleCategory)?.label || selectedRoleCategory}
              </span>
              <button
                onClick={() => setSelectedRoleCategory("All")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove role category filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedExp !== "All" && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Exp: {selectedExp}</span>
              <button
                onClick={() => setSelectedExp("All")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove experience filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedDuration !== "All" && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Duration: {selectedDuration}</span>
              <button
                onClick={() => setSelectedDuration("All")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove duration filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedTechs.map((tech) => (
            <Badge key={tech} variant="accent" className="gap-1 pr-1.5">
              <span>Tech: {tech} ({techMode.toUpperCase()})</span>
              <button
                onClick={() => toggleTech(tech)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label={`Remove ${tech} technology filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          {selectedSkills.map((skill) => (
            <Badge key={skill} variant="accent" className="gap-1 pr-1.5">
              <span>Skill: {skill} ({skillMode.toUpperCase()})</span>
              <button
                onClick={() => toggleSkill(skill)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label={`Remove ${skill} skill filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          {selectedHackathonId !== "All" && (
            <Badge variant="secondary" className="gap-1 pr-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
              <Trophy className="w-3 h-3" />
              <span>Event: {selectedHackathonName}</span>
              <button
                onClick={() => setSelectedHackathonId("All")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove hackathon filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedMode !== "ALL" && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Mode: {selectedMode}</span>
              <button
                onClick={() => setSelectedMode("ALL")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove participation mode filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedTrack !== "All" && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Track: {selectedTrack}</span>
              <button
                onClick={() => setSelectedTrack("All")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove track filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {openRegOnly && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Open Registration Only</span>
              <button
                onClick={() => setOpenRegOnly(false)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove open registration filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {minSpots > 0 && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Min Spots: {minSpots}+</span>
              <button
                onClick={() => setMinSpots(0)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove min spots filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {selectedCommitment !== "All" && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Commitment: {selectedCommitment}</span>
              <button
                onClick={() => setSelectedCommitment("All")}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove commitment filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {beginnerFriendly && (
            <Badge variant="secondary" className="gap-1 pr-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
              <span>Beginner Friendly</span>
              <button
                onClick={() => setBeginnerFriendly(false)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove beginner friendly filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {openOnly && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Spots Available Only</span>
              <button
                onClick={() => setOpenOnly(false)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove spots available filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {hideApplied && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Hide Applied</span>
              <button
                onClick={() => setHideApplied(false)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove hide applied filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {bookmarkedOnly && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Bookmarks Only</span>
              <button
                onClick={() => setBookmarkedOnly(false)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove bookmarks filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {minScore > 0 && (
            <Badge variant="secondary" className="gap-1 pr-1.5">
              <span>Score ≥ {minScore}%</span>
              <button
                onClick={() => setMinScore(0)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove minimum score filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          <button
            onClick={resetFilters}
            className="text-xs text-primary hover:underline font-semibold ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. RESULTS COUNT & STATUS
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Updating results...
            </span>
          ) : (
            `Showing ${roles.length} ${roles.length === 1 ? "vacancy" : "vacancies"}${
              totalCount > roles.length ? ` of ${totalCount}` : ""
            }`
          )}
        </span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. ROLE RESULTS GRID
          ───────────────────────────────────────────────────────────── */}
      {loading && roles.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-5 space-y-4 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
              <div className="flex gap-1.5">
                <Skeleton className="h-6 w-16 rounded" />
                <Skeleton className="h-6 w-16 rounded" />
                <Skeleton className="h-6 w-16 rounded" />
              </div>
              <div className="pt-3 border-t border-border flex justify-between items-center">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <EmptyState
          icon={<Compass className="w-6 h-6 text-primary" />}
          title={activeFiltersCount > 0 ? "No matching opportunities found" : "No open roles available"}
          description={
            activeFiltersCount > 0
              ? "Try broadening your criteria, switching matching mode from 'Match All' to 'Match Any', or resetting specific filters."
              : "There are currently no open project vacancies. Be the first to post a project and recruit teammates!"
          }
          actionLabel={activeFiltersCount > 0 ? "Reset All Filters" : "Post a Project"}
          actionHref={activeFiltersCount > 0 ? undefined : "/projects/new"}
          onAction={activeFiltersCount > 0 ? resetFilters : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              currentUserId={currentUserId}
              isGuest={isGuest}
              onBookmarkToggle={handleToggleBookmark}
              onApplied={handleRoleApplied}
              onMessageClick={handleOpenChat}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center pt-4 pb-8">
          <Button
            variant="outline"
            size="lg"
            disabled={loadingMore}
            onClick={() => fetchRoles(true, nextCursor)}
            className="gap-2 font-medium"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading more opportunities...</span>
              </>
            ) : (
              <span>Load More Vacancies</span>
            )}
          </Button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. ADVANCED FILTER DRAWER
          ───────────────────────────────────────────────────────────── */}
      <AdvancedFiltersDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        activeFiltersCount={activeFiltersCount}
        onResetAll={resetFilters}
        selectedTechs={selectedTechs}
        onToggleTech={toggleTech}
        onClearTechs={() => setSelectedTechs([])}
        techMode={techMode}
        setTechMode={setTechMode}
        selectedSkills={selectedSkills}
        onToggleSkill={toggleSkill}
        onClearSkills={() => setSelectedSkills([])}
        skillMode={skillMode}
        setSkillMode={setSkillMode}
        availableTechs={availableTechs}
        availableSkills={availableSkills}
        availableHackathons={availableHackathons}
        selectedHackathonId={selectedHackathonId}
        setSelectedHackathonId={setSelectedHackathonId}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
        selectedTrack={selectedTrack}
        setSelectedTrack={setSelectedTrack}
        openRegOnly={openRegOnly}
        setOpenRegOnly={setOpenRegOnly}
        selectedCollege={selectedCollege}
        setSelectedCollege={setSelectedCollege}
        selectedDuration={selectedDuration}
        setSelectedDuration={setSelectedDuration}
        minSpots={minSpots}
        setMinSpots={setMinSpots}
        selectedCommitment={selectedCommitment}
        setSelectedCommitment={setSelectedCommitment}
        beginnerFriendly={beginnerFriendly}
        setBeginnerFriendly={setBeginnerFriendly}
        openOnly={openOnly}
        setOpenOnly={setOpenOnly}
        hideApplied={hideApplied}
        setHideApplied={setHideApplied}
        minScore={minScore}
        setMinScore={setMinScore}
        isGuest={isGuest}
      />

      {/* ─────────────────────────────────────────────────────────────
          7. CONTEXTUAL IN-PAGE MESSAGING DRAWER
          ───────────────────────────────────────────────────────────── */}
      <ContextualChatDrawer
        isOpen={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
        context={activeChatContext}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPACT, HIGH-CONTRAST ROLE CARD
// ─────────────────────────────────────────────────────────────
interface RoleCardProps {
  role: MatchedRole;
  currentUserId?: string;
  isGuest: boolean;
  onBookmarkToggle: (roleId: string, currentBookmarked: boolean) => void;
  onApplied: (roleId: string) => void;
  onMessageClick: (context: ContextualChatContext) => void;
}

function RoleCard({
  role,
  currentUserId,
  isGuest,
  onBookmarkToggle,
  onApplied,
  onMessageClick,
}: RoleCardProps) {
  const [applied, setApplied] = useState(role.isApplied || false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const isOwner = currentUserId && role.project.ownerId === currentUserId;

  const score = role.compatibility?.score ?? 0;
  const matchPercentage = Math.round(score * 100);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) {
      window.location.href = "/login?callbackUrl=/discover";
      return;
    }
    setIsApplyModalOpen(true);
  };

  const handleMessageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) {
      window.location.href = "/login?callbackUrl=/discover";
      return;
    }
    onMessageClick({
      recipientId: role.project.ownerId,
      recipientName: role.project.owner.name,
      recipientImage: role.project.owner.image,
      projectId: role.project.id,
      projectTitle: role.project.title,
      roleId: role.id,
      roleTitle: role.title,
    });
  };

  return (
    <Card className="p-4 sm:p-5 flex flex-col justify-between hover:border-border-strong hover:shadow-xs transition-colors rounded-xl bg-card border border-border group gap-3">
      <div>
        {/* Card Header Metadata Bar */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[11px] font-medium">
              {role.project.projectType}
            </Badge>

            {role.project.hackathon && (
              <Badge
                variant="outline"
                className="text-[11px] font-medium border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1"
                title={role.project.hackathon.name}
              >
                <Trophy className="w-3 h-3 text-amber-500" />
                <span className="truncate max-w-[130px]">{role.project.hackathon.name}</span>
              </Badge>
            )}

            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {role.project.duration}
            </span>
          </div>

          {/* Bookmark Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkToggle(role.id, Boolean(role.isBookmarked));
            }}
            aria-label={role.isBookmarked ? "Remove from bookmarks" : "Save role to bookmarks"}
            title={role.isBookmarked ? "Bookmarked" : "Bookmark this role"}
            className={cn(
              "p-1.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              role.isBookmarked
                ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Heart
              className={cn("w-3.5 h-3.5", role.isBookmarked && "fill-current text-rose-500")}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Role Title and Project Name */}
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground leading-snug group-hover:text-primary transition-colors">
            <Link href={`/projects/${role.project.id}`}>{role.title}</Link>
          </h2>
          <p className="text-xs text-muted-foreground">
            In project:{" "}
            <Link
              href={`/projects/${role.project.id}`}
              className="text-foreground font-medium hover:underline hover:text-primary transition-colors"
            >
              {role.project.title}
            </Link>
          </p>
        </div>

        {/* Short Description */}
        {role.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
            {role.description.replace(/<[^>]*>/g, "")}
          </p>
        )}

        {/* Required Skills */}
        {role.requiredSkills && role.requiredSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {role.requiredSkills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border/70"
              >
                {skill}
              </span>
            ))}
            {role.requiredSkills.length > 4 && (
              <span className="text-[11px] text-muted-foreground self-center px-1">
                +{role.requiredSkills.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Vacancy & Commitment Details */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2.5 pt-2 border-t border-border">
          <span className="flex items-center gap-1 font-medium">
            <Users className="w-3.5 h-3.5 text-primary" />
            {role.openSpots > 0 ? (
              <span>{role.openSpots} spot{role.openSpots !== 1 ? "s" : ""} open</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">Position filled</span>
            )}
          </span>
          <span>·</span>
          <span>{role.timeCommitment}</span>
        </div>

        {/* Match Compatibility Information */}
        {!isGuest && role.compatibility && (
          <div className="mt-2.5 p-2 rounded-lg bg-secondary/60 border border-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Compatibility Score
              </span>
              <span className="font-bold text-primary">{matchPercentage}%</span>
            </div>
            {role.compatibility.breakdown && (
              <p className="text-[11px] text-muted-foreground">
                Matched on skills ({Math.round(role.compatibility.breakdown.skillOverlap * 100)}%) and experience requirements.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Project Lead + Actions */}
      <div className="pt-2.5 border-t border-border mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={role.project.owner.image}
            alt={role.project.owner.name || "Owner"}
            size="sm"
            className="w-6 h-6 text-[10px] shrink-0"
          />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground truncate block font-medium max-w-[110px] sm:max-w-[130px]">
              {role.project.owner.name || "Project Lead"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {!isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMessageClick}
              className="h-8 px-2.5 text-xs font-medium gap-1.5 border-border hover:border-primary/40 hover:text-primary transition-colors"
              aria-label={`Message ${role.project.owner.name || "project lead"} about ${role.title}`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>Message</span>
            </Button>
          )}

          <Link href={`/projects/${role.project.id}`}>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground">
              View Role
            </Button>
          </Link>

          {!isOwner && (
            <Button
              size="sm"
              disabled={applied}
              onClick={handleApplyClick}
              className={cn(
                "h-8 px-3 text-xs font-semibold gap-1",
                applied && "bg-emerald-600 text-white hover:bg-emerald-600"
              )}
            >
              {applied ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Applied</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Apply</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <ApplyModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        role={role}
        projectId={role.project.id}
        projectTitle={role.project.title}
        onSuccess={() => {
          setApplied(true);
          onApplied(role.id);
        }}
      />
    </Card>
  );
}

function DiscoverSkeleton() {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-xl" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverSkeleton />}>
      <DiscoverContent />
    </Suspense>
  );
}
