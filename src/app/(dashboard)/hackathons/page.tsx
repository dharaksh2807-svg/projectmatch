"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import {
  Trophy,
  Sparkles,
  Plus,
  Loader2,
  Zap,
  Clock,
  Award,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Filter,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

import { useHackathons } from "@/hooks/useHackathons";
import { HackathonCard } from "@/components/hackathons/hackathon-card";
import { HackathonSkeletonGrid } from "@/components/hackathons/hackathon-skeleton";
import { HackathonFilters } from "@/components/hackathons/hackathon-filters";

interface AIMatchItem {
  roleId: string;
  aiScore: number;
  explanation: string;
  role: {
    id: string;
    title: string;
    requiredSkills: string[];
    project: {
      id: string;
      title: string;
      projectType: string;
    };
  };
}

function HackathonsPageContent() {
  const { toast } = useToast();

  const {
    sections,
    hackathons,
    visibleHackathons,
    visibleCount,
    hasMore,
    loadMore,
    loading,
    error,
    isCuratedSectionsView,
    hasActiveFilters,
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
    selectedCollege,
    setSelectedCollege,
    selectedCity,
    setSelectedCity,
    selectedEligibility,
    setSelectedEligibility,
    resetFilters,
    refresh,
  } = useHackathons();

  // AI Matchmaker State (Preserved from existing UI)
  const [aiMatches, setAiMatches] = useState<AIMatchItem[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  // Load AI Matches on Demand via Gemini
  const handleLoadAiMatches = async () => {
    setLoadingAi(true);
    setAiExpanded(true);
    try {
      const res = await fetch("/api/matches/ai");
      if (res.ok) {
        const data = await res.json();
        setAiMatches(data.matches || []);
        toast("AI matchmaking generated successfully!", "success");
      } else {
        toast("Could not generate AI matches", "error");
      }
    } catch {
      toast("Error connecting to AI matchmaker", "error");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in font-sans min-w-0 overflow-x-hidden">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO BANNER (Preserved ProjectMatch Visual Identity)
          ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950/40 p-4 sm:p-6 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5" />
            Hackathon Arena
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Find Your Winning Hackathon Team
          </h1>

          <p className="text-zinc-300 text-xs sm:text-sm md:text-base leading-relaxed">
            Browse verified national competitions and student hackathons, find teammates with complementary skills, or pitch your squad project to win together.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Button
              onClick={handleLoadAiMatches}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm gap-2 shadow-lg shadow-emerald-900/20"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              {loadingAi ? "Analyzing Skills with Gemini..." : "AI Hackathon Matchmaker"}
            </Button>

            <Link href="/projects/new" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 text-xs sm:text-sm gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Pitch a Project
              </Button>
            </Link>

            <Link href="/hackathons/submit" className="w-full sm:w-auto">
              <Button
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs sm:text-sm gap-1.5 shadow-lg shadow-emerald-950/40 border border-emerald-400/30"
              >
                <Plus className="w-4 h-4" />
                + Post a Hackathon
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="text-zinc-400 hover:text-white hover:bg-white/5 text-xs gap-1.5 ml-auto hidden sm:inline-flex"
              title="Refresh database feed"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Sync Feed
            </Button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. AI MATCHMAKER RECOMMENDATIONS (EXPANDABLE)
          ───────────────────────────────────────────────────────────── */}
      {aiExpanded && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 md:p-6 space-y-4 animate-fade-in shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">AI-Recommended Hackathon Roles</h3>
                <p className="text-xs text-emerald-300/80">
                  Ranked by Gemini AI comparing your profile skills against open team roles
                </p>
              </div>
            </div>
            <button
              onClick={() => setAiExpanded(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>

          {loadingAi ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <p className="text-xs">Computing role compatibility via Gemini...</p>
            </div>
          ) : aiMatches.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">
              No matching hackathon roles found for your current profile. Update your skills in your profile to get personalized matches!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiMatches.map((m) => (
                <Card
                  key={m.roleId}
                  className="bg-zinc-900/90 border-emerald-500/20 hover:border-emerald-500/40 transition-all"
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                          {m.role.project.title}
                        </span>
                        <h4 className="font-semibold text-sm text-white">{m.role.title}</h4>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold text-xs shrink-0">
                        {m.aiScore}% Match
                      </Badge>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {m.explanation}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.role.requiredSkills.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    <Link href={`/projects/${m.role.project.id}`}>
                      <Button
                        size="sm"
                        className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                      >
                        View Project & Apply
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. ADVANCED SEARCH & FILTER CONTROLS
          ───────────────────────────────────────────────────────────── */}
      <HackathonFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedMode={selectedMode}
        onModeChange={setSelectedMode}
        nationalOnly={nationalOnly}
        onNationalChange={setNationalOnly}
        openRegOnly={openRegOnly}
        onOpenRegChange={setOpenRegOnly}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onResetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        totalCount={hackathons.length}
        selectedCollege={selectedCollege}
        onCollegeChange={setSelectedCollege}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        selectedEligibility={selectedEligibility}
        onEligibilityChange={setSelectedEligibility}
      />

      {/* ─────────────────────────────────────────────────────────────
          4. ERROR STATE
          ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Unable to load hackathons</p>
              <p className="text-xs text-destructive/80">{error}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            className="border-destructive/40 hover:bg-destructive/10 text-xs shrink-0"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. CONTENT SECTION: LOADING, EMPTY, OR DISCOVERY GRIDS
          ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading database-backed hackathon opportunities...</span>
          </div>
          <HackathonSkeletonGrid count={6} />
        </div>
      ) : hackathons.length === 0 ? (
        /* ── EMPTY STATE ── */
        <EmptyState
          icon={<Trophy className="w-10 h-10 text-muted-foreground" />}
          title="No Hackathons Found"
          description={
            hasActiveFilters
              ? "No events matched your current search and filter combination. Try clearing some filters or searching for broader terms."
              : "No active hackathons are currently listed in the database. Check back soon for newly synchronized competitions."
          }
          actionLabel={hasActiveFilters ? "Clear All Filters" : "Refresh Data"}
          onAction={hasActiveFilters ? resetFilters : refresh}
        />
      ) : isCuratedSectionsView ? (
        /* ─────────────────────────────────────────────────────────────
            DEFAULT DISCOVERY FEED: 4 CURATED RANKED SECTIONS
            Excludes completed and cancelled events strictly.
            Distinguishes verified national flagships prominently.
           ───────────────────────────────────────────────────────────── */
        <div className="space-y-10">
          {/* SECTION 1: Featured National Competitions */}
          {sections.featured.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      Featured National Competitions
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-semibold">
                        Flagship
                      </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Verified high-impact national initiatives and premier institutional championships.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {sections.featured.length} {sections.featured.length === 1 ? "event" : "events"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sections.featured.map((h) => (
                  <HackathonCard key={h.id} hackathon={h} variant="featured" />
                ))}
              </div>
            </section>
          )}

          {/* SECTION 2: Registration Closing Soon */}
          {sections.closingSoon.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      Registration Closing Soon
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] font-semibold animate-pulse">
                        Urgent
                      </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Registration deadlines expiring within 72 hours. Finalize your squad and register before spots close.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {sections.closingSoon.length} {sections.closingSoon.length === 1 ? "event" : "events"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sections.closingSoon.map((h) => (
                  <HackathonCard key={h.id} hackathon={h} />
                ))}
              </div>
            </section>
          )}

          {/* SECTION: Campus & Local Hackathons (Organizer Submitted Stream) */}
          {sections.localCampus && sections.localCampus.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      Campus & Local Hackathons
                      <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px] font-semibold">
                        Club & Campus
                      </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Competitions hosted by college clubs, student chapters, and regional university sprints.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-medium">
                    {sections.localCampus.length} {sections.localCampus.length === 1 ? "event" : "events"}
                  </span>
                  <Link href="/hackathons/submit">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Post Hackathon
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sections.localCampus.map((h) => (
                  <HackathonCard key={h.id} hackathon={h} />
                ))}
              </div>
            </section>
          )}

          {/* SECTION 3: Upcoming Hackathons (Priority Ranked) */}
          {sections.upcoming.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Upcoming Hackathons
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Ranked deterministically by national credibility, student relevance, learning value, and timeline.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {sections.upcoming.length} {sections.upcoming.length === 1 ? "event" : "events"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sections.upcoming.map((h) => (
                  <HackathonCard key={h.id} hackathon={h} />
                ))}
              </div>
            </section>
          )}

          {/* SECTION 4: Other Verified Opportunities */}
          {sections.other.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Other Verified Opportunities
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Additional verified competitions, upcoming registration announcements, and university sprints.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {sections.other.length} {sections.other.length === 1 ? "event" : "events"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sections.other.map((h) => (
                  <HackathonCard key={h.id} hackathon={h} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            FILTERED / CUSTOM SORT VIEW
            Displays unified filtered results with incremental loading.
           ───────────────────────────────────────────────────────────── */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>
                Showing {Math.min(visibleCount, hackathons.length)} of {hackathons.length} active opportunities
                {searchQuery && ` matching "${searchQuery}"`}
                {selectedCategory !== "All" && ` in ${selectedCategory}`}
                {selectedMode !== "ALL" && ` (${selectedMode.toLowerCase()})`}
                {nationalOnly && " [National Level Only]"}
                {openRegOnly && " [Open Registration]"}
                {selectedCollege !== "ALL" && ` [College: ${selectedCollege}]`}
                {selectedCity !== "ALL" && ` [City: ${selectedCity}]`}
                {selectedEligibility !== "ALL" && ` [Eligibility: ${selectedEligibility.replace(/_/g, " ")}]`}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground h-7"
            >
              Reset Filters
            </Button>
          </div>

          {/* Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleHackathons.map((h) => (
              <HackathonCard key={h.id} hackathon={h} />
            ))}
          </div>

          {/* Incremental Loading / Pagination */}
          {hasMore && (
            <div className="pt-6 flex flex-col items-center justify-center space-y-2">
              <Button
                variant="outline"
                onClick={loadMore}
                className="px-6 py-2 border-border/80 text-xs sm:text-sm font-semibold rounded-xl hover:bg-muted/60 transition-all shadow-sm"
              >
                Load More Hackathons ({hackathons.length - visibleCount} remaining)
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Showing {visibleHackathons.length} of {hackathons.length} events
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HackathonsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading hackathon opportunities...</span>
          </div>
          <HackathonSkeletonGrid count={6} />
        </div>
      }
    >
      <HackathonsPageContent />
    </Suspense>
  );
}
