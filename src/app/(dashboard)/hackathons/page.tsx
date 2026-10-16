"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import {
  Trophy,
  Sparkles,
  Plus,
  Loader2,
  Zap,
  AlertTriangle,
  RefreshCw,
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
    hackathons,
    localCampusHackathons,
    nationalHackathons,
    selectedStream,
    setSelectedStream,
    visibleCount,
    hasMore,
    loadMore,
    loading,
    error,
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
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card/90 to-emerald-950/20 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/40 p-4 sm:p-6 md:p-10 shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5" />
            Hackathon Arena
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            Find Your Winning Hackathon Team
          </h1>

          <p className="text-muted-foreground text-xs sm:text-sm md:text-base leading-relaxed">
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
                className="w-full sm:w-auto border-border text-foreground hover:bg-accent text-xs sm:text-sm gap-1.5"
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
              className="text-muted-foreground hover:text-foreground hover:bg-accent text-xs gap-1.5 ml-auto hidden sm:inline-flex"
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
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/20 p-5 md:p-6 space-y-4 animate-fade-in shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">AI-Recommended Hackathon Roles</h3>
                <p className="text-xs text-muted-foreground">
                  Ranked by Gemini AI comparing your profile skills against open team roles
                </p>
              </div>
            </div>
            <button
              onClick={() => setAiExpanded(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>

          {loadingAi ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500 dark:text-emerald-400" />
              <p className="text-xs">Computing role compatibility via Gemini...</p>
            </div>
          ) : aiMatches.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No matching hackathon roles found for your current profile. Update your skills in your profile to get personalized matches!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiMatches.map((m) => (
                <Card
                  key={m.roleId}
                  className="bg-card border-border hover:border-emerald-500/40 transition-all text-card-foreground shadow-sm"
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                          {m.role.project.title}
                        </span>
                        <h4 className="font-semibold text-sm text-foreground">{m.role.title}</h4>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 font-bold text-xs shrink-0">
                        {m.aiScore}% Match
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {m.explanation}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.role.requiredSkills.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
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
      ) : (
        /* ─────────────────────────────────────────────────────────────
            DUAL-STREAM DISCOVERY VIEW: STRICT SEPARATION
            Stream A: Campus & Local (Organizer & Student Posted)
            Stream B: Top National (Automated & System-Synchronized)
            These two streams are NEVER flattened or mixed together.
           ───────────────────────────────────────────────────────────── */
        <div className="space-y-10">
          {/* STREAM SWITCHER TABS & SUMMARY */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div className="flex flex-wrap items-center p-1 rounded-2xl bg-muted/70 border border-border w-fit gap-1 shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedStream("ALL")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                  selectedStream === "ALL"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>All Opportunities (Dual Stream)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold ml-1">
                  {hackathons.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStream("CAMPUS")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                  selectedStream === "CAMPUS"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                )}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                <span>Campus & Local</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-bold ml-1">
                  {localCampusHackathons.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStream("NATIONAL")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                  selectedStream === "NATIONAL"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-950/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                )}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                <span>Top National</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold ml-1">
                  {nationalHackathons.length}
                </span>
              </button>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Filtered: {hackathons.length} active
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-xs text-emerald-400 hover:text-emerald-300 h-7"
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>

          {/* ═════════════════════════════════════════════════════════════
              STREAM A: CAMPUS & LOCAL HACKATHONS (ORGANIZER POSTED)
              ═════════════════════════════════════════════════════════════ */}
          {(selectedStream === "ALL" || selectedStream === "CAMPUS") && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
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
                      Crowdsourced and hosted by college student chapters, technical clubs (SRM, Anna Univ, IITM, VIT), and regional university circuits.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                  <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-md bg-muted/60">
                    {localCampusHackathons.length} {localCampusHackathons.length === 1 ? "event" : "events"}
                  </span>
                  <Link href="/hackathons/submit">
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs h-8 px-3 rounded-xl gap-1 shadow-md shadow-indigo-950/40 border border-indigo-400/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Post a Hackathon
                    </Button>
                  </Link>
                </div>
              </div>

              {localCampusHackathons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {localCampusHackathons.map((h) => (
                    <HackathonCard key={h.id} hackathon={h} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-indigo-500/30 bg-indigo-950/10 p-6 text-center space-y-3">
                  <Building2 className="w-8 h-8 text-indigo-400/80 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">
                      No Campus Hackathons Match Your Current Filter
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Are you a student club lead, GDSC/ACM coordinator, or hackathon organizer? Be the first to list your campus hackathon and reach student hackers across colleges.
                    </p>
                  </div>
                  <Link href="/hackathons/submit">
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 mt-1">
                      <Plus className="w-3.5 h-3.5" />
                      + Post a Campus Hackathon
                    </Button>
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* ═════════════════════════════════════════════════════════════
              STREAM B: TOP NATIONAL HACKATHONS (AUTOMATED FLAGSHIPS)
              ═════════════════════════════════════════════════════════════ */}
          {(selectedStream === "ALL" || selectedStream === "NATIONAL") && (
            <section className="space-y-4 pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      Top National Hackathons
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-semibold">
                        Automated Flagships
                      </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Verified premier national championships, Smart India Hackathon (SIH), and tier-1 institutional tournaments.
                    </p>
                  </div>
                </div>

                <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-md bg-muted/60 self-start sm:self-auto">
                  {nationalHackathons.length} {nationalHackathons.length === 1 ? "flagship" : "flagships"}
                </span>
              </div>

              {nationalHackathons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {nationalHackathons.map((h, i) => (
                    <HackathonCard
                      key={h.id}
                      hackathon={h}
                      variant={i === 0 && !hasActiveFilters ? "featured" : "default"}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-950/10 p-6 text-center space-y-2">
                  <Trophy className="w-8 h-8 text-amber-400/80 mx-auto" />
                  <h3 className="font-semibold text-sm text-foreground">
                    No National Flagships Match Your Current Filter
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Try broadening your filters or clearing city/campus filters to view pan-India national initiatives.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Incremental Loading / Pagination */}
          {hasMore && (
            <div className="pt-6 flex flex-col items-center justify-center space-y-2 border-t border-border/40">
              <Button
                variant="outline"
                onClick={loadMore}
                className="px-6 py-2 border-border/80 text-xs sm:text-sm font-semibold rounded-xl hover:bg-muted/60 transition-all shadow-sm"
              >
                Load More Hackathons ({hackathons.length - visibleCount} remaining)
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Showing {Math.min(visibleCount, hackathons.length)} of {hackathons.length} events
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
