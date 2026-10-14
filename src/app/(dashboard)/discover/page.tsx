"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  Sparkles,
  Filter,
  Briefcase,
  Clock,
  Layers,
  ChevronRight,
  RotateCcw,
  Zap,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  Loader2,
  Send,
  Heart,
  Eye,
  Code2,
  ArrowUpDown,
  ChevronDown,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

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

const DURATIONS = [
  "All",
  "< 1 week",
  "1-4 weeks",
  "1-3 months",
  "3-6 months",
  "6+ months",
];

const EXPERIENCE_LEVELS: { label: string; value: string }[] = [
  { label: "All", value: "All" },
  { label: "Beginner", value: "Beginner" },
  { label: "Intermediate", value: "Intermediate" },
  { label: "Advanced", value: "Advanced" },
  { label: "Expert", value: "Expert" },
  { label: "Any Level", value: "Any" },
];

const SORT_OPTIONS = [
  { label: "Best Match", value: "match" },
  { label: "Newest First", value: "newest" },
  { label: "Most Spots Open", value: "spots" },
  { label: "Role Title (A-Z)", value: "title" },
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
  const [selectedDuration, setSelectedDuration] = useState("All");
  const [selectedExp, setSelectedExp] = useState("All");

  // Multi-select state for Skills and Tech Stack
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);

  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [openOnly, setOpenOnly] = useState(false);
  const [hideApplied, setHideApplied] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("match");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Available tech stack dynamic tags from backend
  const [availableTechs, setAvailableTechs] = useState<string[]>([]);

  // Preview Modal State
  const [previewRole, setPreviewRole] = useState<MatchedRole | null>(null);

  // Set default sort for guests
  useEffect(() => {
    if (isGuest && sortBy === "match") {
      setSortBy("newest");
    }
  }, [isGuest, sortBy]);

  // Multi-select toggle helpers
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
        if (selectedDuration !== "All") queryParams.append("duration", selectedDuration);
        if (selectedExp !== "All") queryParams.append("exp", selectedExp);

        // Append multi-select skills
        if (selectedSkills.length > 0) {
          selectedSkills.forEach((s) => queryParams.append("skill", s));
        }

        // Append multi-select techs
        if (selectedTechs.length > 0) {
          selectedTechs.forEach((t) => queryParams.append("tech", t));
        }

        if (searchQuery.trim()) queryParams.append("q", searchQuery.trim());
        if (minScoreFilter > 0) queryParams.append("minScore", String(minScoreFilter));
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
        console.error("Failed to load matching roles:", err);
        toast("Failed to load roles. Please check your connection.", "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      selectedType,
      selectedDuration,
      selectedExp,
      selectedSkills,
      selectedTechs,
      searchQuery,
      minScoreFilter,
      openOnly,
      hideApplied,
      bookmarkedOnly,
      sortBy,
      toast,
    ]
  );

  // Trigger fetch with debounce when query filters change
  useEffect(() => {
    if (status === "loading") return;

    const timeoutId = setTimeout(() => {
      fetchRoles(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    status,
    selectedType,
    selectedDuration,
    selectedExp,
    selectedSkills,
    selectedTechs,
    searchQuery,
    minScoreFilter,
    openOnly,
    hideApplied,
    bookmarkedOnly,
    sortBy,
    fetchRoles,
  ]);

  // Extract all unique skills across loaded roles for quick pills
  const allUniqueSkills = useMemo(() => {
    const skillSet = new Set<string>();
    roles.forEach((r) => {
      r.requiredSkills.forEach((s) => skillSet.add(s));
    });
    return Array.from(skillSet).slice(0, 20);
  }, [roles]);

  // Active Filter Factors Count
  const activeFilterFactorsCount = useMemo(() => {
    let count = 0;
    if (selectedType !== "All") count += 1;
    if (selectedDuration !== "All") count += 1;
    if (selectedExp !== "All") count += 1;
    if (selectedTechs.length > 0) count += selectedTechs.length;
    if (selectedSkills.length > 0) count += selectedSkills.length;
    if (searchQuery.trim()) count += 1;
    return count;
  }, [selectedType, selectedDuration, selectedExp, selectedTechs, selectedSkills, searchQuery]);



  const resetFilters = () => {
    setSearchQuery("");
    setSelectedType("All");
    setSelectedDuration("All");
    setSelectedExp("All");
    setSelectedSkills([]);
    setSelectedTechs([]);
    setMinScoreFilter(0);
    setOpenOnly(false);
    setHideApplied(false);
    setBookmarkedOnly(false);
    setSortBy(isGuest ? "newest" : "match");
  };

  const getScoreColor = (score: number) => {
    const percent = Math.round(score * 100);
    if (percent >= 75) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (percent >= 40) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    if (percent > 0) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    return "text-slate-400 bg-slate-500/10 border-slate-500/30";
  };

  const getScoreBadgeText = (score: number) => {
    const percent = Math.round(score * 100);
    return `${percent}% Match`;
  };

  // Toggle bookmark handler passed to cards
  const handleToggleBookmark = async (roleId: string, currentBookmarked: boolean) => {
    if (!currentUserId) {
      toast("Please sign in to save roles to your bookmarks.", "info");
      return;
    }

    // Optimistic UI update
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
          data.bookmarked
            ? "Role saved to bookmarks!"
            : "Role removed from bookmarks.",
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

  // Update application status locally when user applies
  const handleRoleApplied = (roleId: string) => {
    setRoles((prev) =>
      prev.map((r) =>
        r.id === roleId ? { ...r, isApplied: true } : r
      )
    );
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 animate-pulse">
        <div className="border-b border-border/50 pb-6 space-y-3">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-9 w-72 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Discovery
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Discover Opportunities</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isGuest
              ? "Browse open team roles. Sign in to see your personalised match scores and save opportunities."
              : "Browse open team roles scored proportionally against your skills, interests, and availability."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Bookmark View toggle if logged in */}
          {!isGuest && (
            <Button
              variant={bookmarkedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              className="flex items-center gap-1.5"
            >
              <Heart
                className={cn(
                  "w-4 h-4",
                  bookmarkedOnly ? "fill-current text-rose-300" : "text-muted-foreground"
                )}
              />
              <span>{bookmarkedOnly ? "Saved Only" : "Bookmarks"}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex items-center gap-2"
            aria-label="Toggle filter sidebar"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>

          {isGuest ? (
            <Link href="/login" tabIndex={-1}>
              <Button size="sm" className="brand-gradient text-white shadow-lg glow-sm">
                Sign In to Post
              </Button>
            </Link>
          ) : (
            <Link href="/projects/new" tabIndex={-1}>
              <Button size="sm" className="brand-gradient text-white shadow-lg glow-sm">
                Post a Project
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Main Layout: Sidebar Filters + Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Left-hand Sidebar for Filters */}
        <aside
          className={cn(
            "lg:col-span-1 space-y-6 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/60 shadow-sm sticky top-6",
            !sidebarOpen && "hidden lg:block"
          )}
        >
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Filter className="w-4 h-4 text-primary" />
              <span>Filters</span>
            </div>
            <button
              onClick={resetFilters}
              aria-label="Reset all filters"
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              Reset
            </button>
          </div>

          {/* Search by keyword */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Search Roles & Projects
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="React, AI/ML, Fintech..."
                value={searchQuery}
                aria-label="Search roles and projects"
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 text-sm h-9 focus-visible:ring-primary/50"
              />
            </div>
          </div>

          {/* Quick Availability Toggles */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Preferences
            </label>

            {/* Spots Available Toggle */}
            <label className="flex items-center justify-between text-xs cursor-pointer select-none py-1 hover:text-primary transition-colors">
              <span className="font-medium text-foreground/80 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-primary" />
                Spots Available Only
              </span>
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
                className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
              />
            </label>

            {/* Hide Applied Roles Toggle (Authed users) */}
            {!isGuest && (
              <label className="flex items-center justify-between text-xs cursor-pointer select-none py-1 hover:text-primary transition-colors">
                <span className="font-medium text-foreground/80 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Hide Applied Roles
                </span>
                <input
                  type="checkbox"
                  checked={hideApplied}
                  onChange={(e) => setHideApplied(e.target.checked)}
                  className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                />
              </label>
            )}
          </div>

          {/* Project Type Filter */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Project Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  aria-pressed={selectedType === type}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selectedType === type
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-accent hover:text-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Tech Stack Multi-Select Filter */}
          {availableTechs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-primary" />
                  Tech Stack
                  {selectedTechs.length > 0 && (
                    <span className="text-primary font-bold">({selectedTechs.length})</span>
                  )}
                </label>
                {selectedTechs.length > 0 && (
                  <button
                    onClick={() => setSelectedTechs([])}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {availableTechs.map((tech) => {
                  const isSelected = selectedTechs.includes(tech);
                  return (
                    <button
                      key={tech}
                      onClick={() => toggleTech(tech)}
                      aria-pressed={isSelected}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 flex items-center gap-1",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span>{tech}</span>
                      {isSelected && <X className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Duration Filter */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Project Duration
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((dur) => (
                <button
                  key={dur}
                  onClick={() => setSelectedDuration(dur)}
                  aria-pressed={selectedDuration === dur}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selectedDuration === dur
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-accent hover:text-foreground"
                  )}
                >
                  {dur}
                </button>
              ))}
            </div>
          </div>

          {/* Experience Level Filter */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Experience Level
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPERIENCE_LEVELS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setSelectedExp(value)}
                  aria-pressed={selectedExp === value}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selectedExp === value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-accent hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Skills Multi-Select Filter */}
          {allUniqueSkills.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Filter by Skills
                  {selectedSkills.length > 0 && (
                    <span className="text-primary font-bold ml-1">({selectedSkills.length})</span>
                  )}
                </label>
                {selectedSkills.length > 0 && (
                  <button
                    onClick={() => setSelectedSkills([])}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allUniqueSkills.map((skill) => {
                  const isSelected = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={isSelected}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 flex items-center gap-1",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-secondary/30 text-muted-foreground border-border/30 hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span>{skill}</span>
                      {isSelected && <X className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Minimum Compatibility Threshold */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-muted-foreground uppercase tracking-wider">
                Min Match Score
              </span>
              <span className="font-bold text-primary">{minScoreFilter}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              aria-label="Minimum Match Score"
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(parseInt(e.target.value))}
              className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Control Bar: Sort Options & Results Count */}
          <div className="flex flex-col gap-3 bg-card/40 backdrop-blur-sm p-4 rounded-xl border border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">
                  {bookmarkedOnly
                    ? `Saved Roles (${totalCount})`
                    : `All Roles (${totalCount})`}
                </span>
                {openOnly && (
                  <Badge variant="secondary" className="text-[11px] bg-primary/10 text-primary">
                    Spots Open Only
                  </Badge>
                )}
                {activeFilterFactorsCount > 0 && (
                  <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/30 font-semibold">
                    {activeFilterFactorsCount} Active {activeFilterFactorsCount === 1 ? "Filter Factor" : "Filter Factors"}
                  </Badge>
                )}
              </div>

              {/* Sort Control Dropdown */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sort by:</span>
                <div className="flex flex-wrap gap-1">
                  {SORT_OPTIONS.map((opt) => {
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setSortBy(opt.value)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-md font-medium transition-all",
                          sortBy === opt.value
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Active Filters Badges for all active criteria */}
            {activeFilterFactorsCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground mr-1 text-[11px] font-medium">
                  Active Filters ({activeFilterFactorsCount}):
                </span>
                {selectedType !== "All" && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] gap-1 cursor-pointer bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    onClick={() => setSelectedType("All")}
                    title="Click to remove type filter"
                  >
                    Type: {selectedType}
                    <X className="w-3 h-3" />
                  </Badge>
                )}
                {selectedDuration !== "All" && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] gap-1 cursor-pointer bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    onClick={() => setSelectedDuration("All")}
                    title="Click to remove duration filter"
                  >
                    Duration: {selectedDuration}
                    <X className="w-3 h-3" />
                  </Badge>
                )}
                {selectedExp !== "All" && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] gap-1 cursor-pointer bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    onClick={() => setSelectedExp("All")}
                    title="Click to remove experience filter"
                  >
                    Exp: {selectedExp}
                    <X className="w-3 h-3" />
                  </Badge>
                )}
                {selectedTechs.map((tech) => (
                  <Badge
                    key={tech}
                    variant="secondary"
                    className="text-[11px] gap-1 cursor-pointer bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20"
                    onClick={() => toggleTech(tech)}
                    title="Click to remove tech"
                  >
                    Tech: {tech}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
                {selectedSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-[11px] gap-1 cursor-pointer bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    onClick={() => toggleSkill(skill)}
                    title="Click to remove skill"
                  >
                    Skill: {skill}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
                {searchQuery.trim() && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] gap-1 cursor-pointer bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                    onClick={() => setSearchQuery("")}
                    title="Click to clear search"
                  >
                    Query: &quot;{searchQuery.trim()}&quot;
                    <X className="w-3 h-3" />
                  </Badge>
                )}
                <button
                  onClick={resetFilters}
                  className="text-[11px] text-muted-foreground hover:text-primary ml-1 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-6">
              <Skeleton className="h-8 w-64 rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="bg-card/40 border-border/40 p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <Skeleton className="h-5 w-36 rounded" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-48 rounded" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full rounded" />
                      <Skeleton className="h-3 w-4/5 rounded" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-6 w-16 rounded-md" />
                      <Skeleton className="h-6 w-16 rounded-md" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!loading && roles.length === 0 && (
            <EmptyState
              icon={<Layers />}
              title={bookmarkedOnly ? "No Saved Roles" : "No Matching Roles"}
              description={
                bookmarkedOnly
                  ? "You haven't bookmarked any project roles yet. Click the heart icon on any role card to save it!"
                  : "No open roles matched your selected filters or search query. Try resetting or relaxing your filters."
              }
              actionLabel="Reset All Filters"
              onAction={resetFilters}
            />
          )}

          {!loading && roles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl brand-gradient flex items-center justify-center text-white glow-sm">
                    {activeFilterFactorsCount > 0 ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <Layers className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      {activeFilterFactorsCount > 0 ? "Matched Roles" : "Browse Projects"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {activeFilterFactorsCount > 0
                        ? `Showing all roles ranked by best match (highest skills overlap first)`
                        : "Explore all open roles and projects across hackathons, startups, and open source"}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary border-primary/20">
                  Showing {roles.length} of {totalCount} {totalCount === 1 ? "role" : "roles"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {roles.map((role) => (
                  <ProjectRoleCard
                    key={role.id}
                    role={role}
                    isRecommended={Boolean(
                      role.compatibility &&
                        role.compatibility.hasActiveFilters &&
                        role.compatibility.score >= 0.5
                    )}
                    scoreColor={getScoreColor(role.compatibility?.score || 0)}
                    scoreText={getScoreBadgeText(role.compatibility?.score || 0)}
                    currentUserId={currentUserId}
                    onToggleBookmark={handleToggleBookmark}
                    onPreviewRole={(r) => setPreviewRole(r)}
                    onApplied={handleRoleApplied}
                  />
                ))}
              </div>

              {/* Infinite Scroll / Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-8 pb-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchRoles(true, nextCursor)}
                    disabled={loadingMore}
                    className="gap-2 px-6 shadow-sm border-border/80"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading more roles...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>Load More Opportunities</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Role Description & Details Quick-Preview Modal */}
      {previewRole && (
        <Dialog open={Boolean(previewRole)} onOpenChange={(open) => !open && setPreviewRole(null)}>
          <DialogContent className="max-w-lg bg-card/95 backdrop-blur-md border-border/80 p-6 space-y-4">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs uppercase font-semibold">
                  {previewRole.project.projectType}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1 inline" />
                  {previewRole.project.duration}
                </Badge>
                {previewRole.compatibility && previewRole.compatibility.hasActiveFilters && (
                  <Badge className={cn("text-xs font-bold ml-auto", getScoreColor(previewRole.compatibility.score))}>
                    <Zap className="w-3 h-3 mr-1 inline fill-current" />
                    {Math.round(previewRole.compatibility.score * 100)}% Match
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {previewRole.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Part of project:{" "}
                <Link
                  href={`/projects/${previewRole.project.id}`}
                  className="text-primary font-semibold hover:underline"
                >
                  {previewRole.project.title}
                </Link>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-sm">
              {/* Active Filter Match breakdown if available */}
              {previewRole.compatibility && previewRole.compatibility.hasActiveFilters && previewRole.compatibility.totalFactors > 0 && (
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">Requirements Matched</span>
                  <span className="font-bold text-primary">
                    {previewRole.compatibility.factorsMatched} / {previewRole.compatibility.totalFactors} requirements ({Math.round(previewRole.compatibility.score * 100)}%)
                  </span>
                </div>
              )}

              {/* Role Description */}
              {previewRole.description ? (
                <div className="space-y-1 bg-secondary/30 p-3 rounded-xl border border-border/40">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Role Responsibilities
                  </span>
                  <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {previewRole.description}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No specific role description provided. Refer to the project overview.
                </p>
              )}

              {/* Project Description snippet */}
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Project Overview
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {previewRole.project.description.replace(/<[^>]*>?/gm, "")}
                </p>
              </div>

              {/* Required Skills */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Required Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {previewRole.requiredSkills.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Tech Stack */}
              {previewRole.project.techStack && previewRole.project.techStack.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Project Tech Stack
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {previewRole.project.techStack.map((tech) => (
                      <Badge key={tech} variant="outline" className="text-xs bg-secondary/20">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Headcount, Commitment, Experience */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
                <div>
                  <span className="text-muted-foreground block">Spots Open</span>
                  <span className="font-semibold">{previewRole.openSpots} / {previewRole.headcount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Commitment</span>
                  <span className="font-semibold">{previewRole.timeCommitment}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Experience</span>
                  <span className="font-semibold">{previewRole.requiredExperienceLevel}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 flex justify-between gap-2 sm:justify-between">
              <Link href={`/projects/${previewRole.project.id}`}>
                <Button size="sm" variant="outline" className="text-xs">
                  View Full Project
                </Button>
              </Link>
              <DialogClose render={<Button size="sm" variant="secondary" className="text-xs">Close</Button>} />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Sub-component: Role Card
function ProjectRoleCard({
  role,
  isRecommended,
  scoreColor,
  scoreText,
  currentUserId,
  onToggleBookmark,
  onPreviewRole,
  onApplied,
}: {
  role: MatchedRole;
  isRecommended: boolean;
  scoreColor: string;
  scoreText: string;
  currentUserId?: string;
  onToggleBookmark: (roleId: string, current: boolean) => void;
  onPreviewRole: (role: MatchedRole) => void;
  onApplied: (roleId: string) => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(Boolean(role.isApplied));
  const isOwner = currentUserId === role.project.ownerId;
  const openSpots = role.openSpots ?? Math.max(role.headcount - role.filledCount, 0);

  async function handleApply() {
    if (!currentUserId) {
      toast("Please sign in to apply for projects.", "info");
      router.push("/login");
      return;
    }

    setApplying(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: role.id, actionType: "APPLY" }),
      });
      const data = await res.json();
      if (res.status === 201) {
        setApplied(true);
        onApplied(role.id);
        toast(`Applied to "${role.title}" successfully!`, "success");
      } else if (res.status === 409) {
        setApplied(true);
        onApplied(role.id);
        toast(data.error || "You already applied to this role.", "info");
      } else if (res.status === 429) {
        toast("Too many requests. Please try again in a few minutes.", "error");
      } else {
        toast(data.error || "Failed to apply. Please try again.", "error");
      }
    } catch {
      toast("Network error. Please check your connection.", "error");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card
      className={cn(
        "group flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card/70 backdrop-blur-sm border-border/60 relative",
        isRecommended && "border-primary/40 shadow-sm hover:border-primary/70",
        applied && "opacity-90 border-emerald-500/20"
      )}
    >
      <CardHeader className="p-5 pb-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          {/* Project Type & Duration badges */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold py-0.5 px-2 bg-secondary/40">
              {role.project.projectType}
            </Badge>
            <Badge variant="outline" className="text-xs text-muted-foreground py-0.5 px-2 bg-secondary/20">
              <Clock className="w-3 h-3 mr-1 inline" aria-hidden="true" />
              {role.project.duration}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Prominent Match Score in Top-Right: Shown ONLY when active filters exist */}
            {role.compatibility && role.compatibility.hasActiveFilters && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border shadow-sm transition-transform group-hover:scale-105",
                  scoreColor
                )}
                title={`Matched ${role.compatibility.factorsMatched} of ${role.compatibility.totalFactors} requirements (${Math.round(role.compatibility.score * 100)}%)`}
              >
                <Zap className="w-3 h-3 fill-current" />
                <span>{scoreText}</span>
              </div>
            )}

            {/* Bookmark / Heart Button */}
            <button
              onClick={() => onToggleBookmark(role.id, Boolean(role.isBookmarked))}
              className={cn(
                "p-1.5 rounded-lg border transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                role.isBookmarked
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                  : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
              )}
              title={role.isBookmarked ? "Remove from bookmarks" : "Save role"}
              aria-label={role.isBookmarked ? "Remove from bookmarks" : "Save role"}
            >
              <Heart
                className={cn(
                  "w-3.5 h-3.5 transition-colors",
                  role.isBookmarked && "fill-current text-rose-500"
                )}
              />
            </button>
          </div>
        </div>

        {/* Project Title & Role Title */}
        <div>
          <Link href={`/projects/${role.project.id}`}>
            <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-primary transition-colors cursor-pointer">
              {role.project.title}
            </CardTitle>
          </Link>
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-2 min-w-0">
              <Briefcase className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground/90 truncate">{role.title}</span>
            </div>

            {/* Quick-Preview Popover Button */}
            <button
              onClick={() => onPreviewRole(role)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 p-1 rounded hover:bg-secondary/40"
              title="Preview role responsibilities & project overview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="text-[11px]">Preview</span>
            </button>
          </div>
        </div>

        {/* Snippet of Description */}
        <CardDescription className="text-xs line-clamp-2 text-muted-foreground leading-relaxed pt-1">
          {role.description
            ? role.description
            : role.project.description.replace(/<[^>]*>?/gm, "")}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4 flex-1">
        {/* Required Skills Row */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Required Skills
          </span>
          <div className="flex flex-wrap gap-1.5">
            {role.requiredSkills.length > 0 ? (
              role.requiredSkills.map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="text-xs font-medium px-2 py-0.5 bg-secondary/60 hover:bg-secondary border-border/40"
                >
                  {skill}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">None explicitly required</span>
            )}
          </div>
        </div>

        {/* Project Tech Stack (if available) */}
        {role.project.techStack && role.project.techStack.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Code2 className="w-3 h-3 text-muted-foreground/80" />
              Tech Stack
            </span>
            <div className="flex flex-wrap gap-1">
              {role.project.techStack.slice(0, 4).map((tech) => (
                <span
                  key={tech}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                >
                  {tech}
                </span>
              ))}
              {role.project.techStack.length > 4 && (
                <span className="text-[11px] text-muted-foreground self-center">
                  +{role.project.techStack.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Commitment & Headcount Specs */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>{role.timeCommitment}</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Users className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span
              className={cn(
                openSpots > 0 ? "text-emerald-500 font-medium" : "text-rose-400 font-medium"
              )}
            >
              {openSpots} {openSpots === 1 ? "spot open" : "spots open"}
            </span>
          </div>
        </div>

        {/* Granular Active Filters match breakdown preview */}
        {role.compatibility && role.compatibility.hasActiveFilters && role.compatibility.totalFactors > 0 && (
          <div className="bg-primary/5 rounded-xl p-2.5 border border-primary/10 text-xs space-y-1.5">
            <div className="flex justify-between font-semibold pb-1 border-b border-primary/10 text-foreground">
              <span>Requirements Matched</span>
              <span className="text-primary font-bold">
                {role.compatibility.factorsMatched} / {role.compatibility.totalFactors} ({Math.round(role.compatibility.score * 100)}%)
              </span>
            </div>
            {role.compatibility.totalFactors > 1 && (
              <div className="space-y-1 text-muted-foreground pt-0.5">
                {role.compatibility.breakdown.techOverlap !== undefined && role.compatibility.breakdown.techOverlap > 0 && (
                  <div className="flex justify-between">
                    <span>Tech Stack Fit</span>
                    <span className="font-semibold text-foreground">
                      {Math.round(role.compatibility.breakdown.techOverlap * 100)}%
                    </span>
                  </div>
                )}
                {role.compatibility.breakdown.skillOverlap > 0 && (
                  <div className="flex justify-between">
                    <span>Skills Fit</span>
                    <span className="font-semibold text-foreground">
                      {Math.round(role.compatibility.breakdown.skillOverlap * 100)}%
                    </span>
                  </div>
                )}
                {role.compatibility.breakdown.typeFit !== undefined && role.compatibility.breakdown.typeFit > 0 && (
                  <div className="flex justify-between">
                    <span>Project Type</span>
                    <span className="font-semibold text-emerald-400">Match</span>
                  </div>
                )}
                {role.compatibility.breakdown.durationFit !== undefined && role.compatibility.breakdown.durationFit > 0 && (
                  <div className="flex justify-between">
                    <span>Project Duration</span>
                    <span className="font-semibold text-emerald-400">Match</span>
                  </div>
                )}
                {role.compatibility.breakdown.experienceFit > 0 && (
                  <div className="flex justify-between">
                    <span>Experience Level</span>
                    <span className="font-semibold text-emerald-400">Match</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-5 pt-0 border-t border-border/40 mt-auto flex items-center justify-between">
        {/* Owner Info */}
        <div className="flex items-center gap-2 pt-3">
          <Link href={`/profile/${role.project.ownerId}`}>
            <Avatar
              src={role.project.owner.image}
              alt={role.project.owner.name || "Owner"}
              size="sm"
              className="w-6 h-6 text-[10px] ring-1 ring-border/50 hover:ring-primary transition-colors cursor-pointer"
            />
          </Link>
          <div className="min-w-0">
            <Link href={`/profile/${role.project.ownerId}`}>
              <span className="text-xs text-muted-foreground truncate max-w-[100px] block hover:underline hover:text-primary transition-colors cursor-pointer">
                {role.project.owner.name || "Project Lead"}
              </span>
            </Link>
            {role.project.owner.reputationScore !== undefined && (
              <ReputationBadge score={role.project.owner.reputationScore} size="xs" />
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 flex items-center gap-2">
          <Link href={`/projects/${role.project.id}`} tabIndex={-1}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1 focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label={`View details for ${role.project.title}`}
            >
              <span>Details</span>
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
            </Button>
          </Link>

          {!isOwner && (
            <Button
              size="sm"
              disabled={applying || applied}
              onClick={handleApply}
              aria-label={`Apply for ${role.title} on ${role.project.title}`}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5 transition-all",
                applied
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isRecommended
                  ? "brand-gradient text-white shadow-sm"
                  : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white"
              )}
            >
              {applying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : applied ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
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
      </CardFooter>
    </Card>
  );
}
