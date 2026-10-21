"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
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
  Check,
  Compass,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApplyModal } from "@/components/applications/apply-modal";

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
    owner: {
      name: string | null;
      image: string | null;
      reputationScore?: number;
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
      availabilityFit?: number;
      interestAlignment?: number;
      reputationScore?: number;
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
];

export default function DiscoverPage() {
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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedExp, setSelectedExp] = useState("All");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [openOnly, setOpenOnly] = useState(false);
  const [hideApplied, setHideApplied] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("match");

  // Advanced Filter Modal / Drawer state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [availableTechs, setAvailableTechs] = useState<string[]>([]);


  // Default sort for guests
  useEffect(() => {
    if (isGuest && sortBy === "match") {
      setSortBy("newest");
    }
  }, [isGuest, sortBy]);

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

  // Main Fetch function
  const fetchRoles = useCallback(
    async (isLoadMore = false, cursorToUse?: string | null) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const queryParams = new URLSearchParams();
        if (selectedType !== "All") queryParams.append("type", selectedType);
        if (selectedExp !== "All") queryParams.append("exp", selectedExp);

        if (selectedSkills.length > 0) {
          selectedSkills.forEach((s) => queryParams.append("skill", s));
        }

        if (selectedTechs.length > 0) {
          selectedTechs.forEach((t) => queryParams.append("tech", t));
        }

        if (searchQuery.trim()) queryParams.append("q", searchQuery.trim());
        if (openOnly) queryParams.append("openOnly", "true");
        if (hideApplied) queryParams.append("hideApplied", "true");
        if (bookmarkedOnly) queryParams.append("bookmarkedOnly", "true");
        if (sortBy) queryParams.append("sort", sortBy);
        queryParams.append("limit", "12");

        if (isLoadMore && cursorToUse) {
          queryParams.append("cursor", cursorToUse);
        }

        const res = await fetch(`/api/matches/roles?${queryParams.toString()}`);
        if (res.ok) {
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
        }
      } catch (err) {
        console.error("Failed to fetch roles:", err);
        toast("Failed to load roles. Please try again.", "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      selectedType,
      selectedExp,
      selectedSkills,
      selectedTechs,
      searchQuery,
      openOnly,
      hideApplied,
      bookmarkedOnly,
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

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedType("All");
    setSelectedExp("All");
    setSelectedSkills([]);
    setSelectedTechs([]);
    setOpenOnly(false);
    setHideApplied(false);
    setBookmarkedOnly(false);
    setSortBy(isGuest ? "newest" : "match");
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedType !== "All") count++;
    if (selectedExp !== "All") count++;
    if (selectedSkills.length > 0) count += selectedSkills.length;
    if (selectedTechs.length > 0) count += selectedTechs.length;
    if (openOnly) count++;
    if (hideApplied) count++;
    if (bookmarkedOnly) count++;
    return count;
  }, [
    searchQuery,
    selectedType,
    selectedExp,
    selectedSkills,
    selectedTechs,
    openOnly,
    hideApplied,
    bookmarkedOnly,
  ]);

  const handleToggleBookmark = async (roleId: string, currentBookmarked: boolean) => {
    if (!currentUserId) {
      toast("Please sign in to bookmark roles.", "info");
      return;
    }

    // Optimistic update
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
        // Revert on failure
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

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans min-w-0">
      {/* ─────────────────────────────────────────────────────────────
          1. CONCISE PAGE HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Discover Opportunities
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Browse open team vacancies scored algorithmically against your skills and availability.
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
          2. HORIZONTAL SEARCH & FILTER CONTROL BAR
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        {/* Search Input - gets greatest horizontal space */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles, required skills, or projects..."
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

        {/* Quick Filters & Sorting */}
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

          {/* Advanced Filters Drawer Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterDrawerOpen(true)}
            className="gap-1.5 h-10 px-3 rounded-xl text-xs font-medium"
            aria-label="Open advanced filters"
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
          3. APPLIED FILTER CHIPS WITH INDIVIDUAL REMOVAL
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
                aria-label="Remove search filter"
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

          {selectedSkills.map((skill) => (
            <Badge key={skill} variant="accent" className="gap-1 pr-1.5">
              <span>Skill: {skill}</span>
              <button
                onClick={() => toggleSkill(skill)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label={`Remove ${skill} skill filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          {selectedTechs.map((tech) => (
            <Badge key={tech} variant="accent" className="gap-1 pr-1.5">
              <span>Tech: {tech}</span>
              <button
                onClick={() => toggleTech(tech)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label={`Remove ${tech} technology filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

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
          Spacious 3-column / 2-column grid without narrow cramping
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
          title={activeFiltersCount > 0 ? "No matching roles found" : "No open roles available"}
          description={
            activeFiltersCount > 0
              ? "Try adjusting your search query, clearing specific skill filters, or resetting your criteria."
              : "There are currently no open project vacancies. Be the first to post a project and recruit teammates!"
          }
          actionLabel={activeFiltersCount > 0 ? "Reset Filters" : "Post a Project"}
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
          6. ADVANCED FILTER MODAL / DRAWER
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>Advanced Filters</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Refine your discovery results by technology stack, preferences, and availability.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Preferences Toggles */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Preferences
              </span>

              <label className="flex items-center justify-between text-xs cursor-pointer p-2 rounded-xl hover:bg-secondary transition-colors border border-border">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Spots Available Only
                </span>
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(e) => setOpenOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-primary border-input focus:ring-primary"
                />
              </label>

              {!isGuest && (
                <label className="flex items-center justify-between text-xs cursor-pointer p-2 rounded-xl hover:bg-secondary transition-colors border border-border">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Hide Already Applied
                  </span>
                  <input
                    type="checkbox"
                    checked={hideApplied}
                    onChange={(e) => setHideApplied(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-input focus:ring-primary"
                  />
                </label>
              )}
            </div>

            {/* Tech Stack Multi-Select */}
            {availableTechs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Technologies ({selectedTechs.length} selected)
                  </span>
                  {selectedTechs.length > 0 && (
                    <button
                      onClick={() => setSelectedTechs([])}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 border border-border rounded-xl bg-card">
                  {availableTechs.map((tech) => {
                    const isSelected = selectedTechs.includes(tech);
                    return (
                      <button
                        key={tech}
                        type="button"
                        onClick={() => toggleTech(tech)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium flex items-center gap-1",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{tech}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:justify-between items-center pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
              Reset All
            </Button>
            <Button
              size="sm"
              onClick={() => setFilterDrawerOpen(false)}
              className="font-semibold shadow-xs"
            >
              Apply Filters ({activeFiltersCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
}

function RoleCard({
  role,
  currentUserId,
  isGuest,
  onBookmarkToggle,
  onApplied,
}: RoleCardProps) {
  const [applied, setApplied] = useState(role.isApplied || false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const isOwner = currentUserId && role.project.ownerId === currentUserId;

  const score = role.compatibility?.score ?? 0;
  const matchPercentage = Math.round(score * 100);

  const handleApplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) {
      window.location.href = "/login";
      return;
    }
    setIsApplyModalOpen(true);
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
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {role.project.duration}
            </span>
          </div>

          {/* Separate Accessible Bookmark Control */}
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
                Matched on skills ({Math.round(role.compatibility.breakdown.skillOverlap * 100)}%) and experience level.
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

        <div className="flex items-center gap-1.5 shrink-0">
          <Link href={`/projects/${role.project.id}`}>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
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
