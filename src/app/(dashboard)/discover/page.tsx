"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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

interface MatchedRole {
  id: string;
  title: string;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  project: {
    id: string;
    title: string;
    description: string;
    projectType: string;
    duration: string;
    ownerId: string;
    owner: {
      name: string | null;
      image: string | null;
      reputationScore?: number;
    };
  };
  compatibility?: {
    score: number;
    breakdown: {
      skillOverlap: number;
      availabilityFit: number;
      interestAlignment: number;
      experienceFit: number;
      reputationScore: number;
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

const EXPERIENCE_LEVELS = [
  "All",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
  "Any",
];

export default function DiscoverPage() {
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const [roles, setRoles] = useState<MatchedRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedDuration, setSelectedDuration] = useState("All");
  const [selectedExp, setSelectedExp] = useState("All");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch roles from the Phase 3 matching API
  useEffect(() => {
    async function fetchMatches() {
      setLoading(true);
      try {
        const res = await fetch("/api/matches/roles");
        if (res.ok) {
          const data = await res.json();
          setRoles(data.results || []);
        }
      } catch (err) {
        console.error("Failed to load matching roles:", err);
      } finally {
        setLoading(false);
      }
    }

    if (status !== "loading") {
      fetchMatches();
    }
  }, [status]);

  // Extract all unique skills across all available roles for quick filtering
  const allUniqueSkills = useMemo(() => {
    const skillSet = new Set<string>();
    roles.forEach((r) => {
      r.requiredSkills.forEach((s) => skillSet.add(s));
    });
    return Array.from(skillSet).slice(0, 15);
  }, [roles]);

  // Separate Recommended (score >= 0.5 or highest ranked) vs All Open Roles
  const { recommendedRoles, otherRoles } = useMemo(() => {
    const filtered = roles.filter((role) => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = role.title.toLowerCase().includes(query);
        const matchesProject = role.project.title.toLowerCase().includes(query);
        const matchesDesc = role.project.description.toLowerCase().includes(query);
        const matchesSkill = role.requiredSkills.some((s) => s.toLowerCase().includes(query));
        if (!matchesTitle && !matchesProject && !matchesDesc && !matchesSkill) {
          return false;
        }
      }

      // Project type filter
      if (selectedType !== "All" && role.project.projectType.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      // Duration filter
      if (selectedDuration !== "All" && role.project.duration.toLowerCase() !== selectedDuration.toLowerCase()) {
        return false;
      }

      // Experience level filter
      if (selectedExp !== "All" && role.requiredExperienceLevel.toLowerCase() !== selectedExp.toLowerCase()) {
        return false;
      }

      // Skill filter
      if (selectedSkill && !role.requiredSkills.some((s) => s.toLowerCase() === selectedSkill.toLowerCase())) {
        return false;
      }

      // Minimum score filter
      if (role.compatibility && role.compatibility.score < minScoreFilter / 100) {
        return false;
      }

      return true;
    });

    // Pinned Recommended: Roles with score >= 0.50 (if user is logged in)
    const recommended = filtered.filter(
      (r) => r.compatibility && r.compatibility.score >= 0.5
    );
    const others = filtered.filter(
      (r) => !r.compatibility || r.compatibility.score < 0.5
    );

    return { recommendedRoles: recommended, otherRoles: others };
  }, [roles, searchQuery, selectedType, selectedDuration, selectedExp, selectedSkill, minScoreFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedType("All");
    setSelectedDuration("All");
    setSelectedExp("All");
    setSelectedSkill("");
    setMinScoreFilter(0);
  };

  const getScoreColor = (score: number) => {
    const percent = score * 100;
    if (percent >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (percent >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-slate-400 bg-slate-500/10 border-slate-500/30";
  };

  const getScoreBadgeText = (score: number) => {
    const percent = Math.round(score * 100);
    return `${percent}% Match`;
  };

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
            Browse open team roles scored and matched against your skills, interests, and availability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>
          <Link href="/projects/new">
            <Button size="sm" className="brand-gradient text-white shadow-lg glow-sm">
              Post a Project
            </Button>
          </Link>
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
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Search by keyword */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Search Roles & Projects
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="React, AI/ML, Fintech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 text-sm h-9"
              />
            </div>
          </div>

          {/* Project Type Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Project Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium",
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

          {/* Duration Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Project Duration
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((dur) => (
                <button
                  key={dur}
                  onClick={() => setSelectedDuration(dur)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium",
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
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Experience Level
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPERIENCE_LEVELS.map((exp) => (
                <button
                  key={exp}
                  onClick={() => setSelectedExp(exp)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium",
                    selectedExp === exp
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-accent hover:text-foreground"
                  )}
                >
                  {exp}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Skills Filter */}
          {allUniqueSkills.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Filter by Skill
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allUniqueSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => setSelectedSkill(selectedSkill === skill ? "" : skill)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium",
                      selectedSkill === skill
                        ? "bg-primary/20 text-primary border-primary/50 shadow-sm"
                        : "bg-secondary/30 text-muted-foreground border-border/30 hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Minimum Compatibility Threshold (if logged in) */}
          {session?.user && (
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
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(parseInt(e.target.value))}
                className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-10">
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
              icon={Layers}
              title="No Open Roles Found"
              description="There are currently no open project roles in the database. Be the first to create one and start matching!"
              actionLabel="Post a New Project"
              actionHref="/projects/new"
            />
          )}

          {!loading && roles.length > 0 && recommendedRoles.length === 0 && otherRoles.length === 0 && (
            <EmptyState
              icon={Search}
              title="No Matching Roles"
              description="No open roles matched your search query and filter criteria. Try adjusting or resetting your filters."
              actionLabel="Reset All Filters"
              onAction={resetFilters}
            />
          )}

          {!loading && roles.length > 0 && (
            <>
              {/* SECTION 1: "Recommended for You" (Pinned at top) */}
              {recommendedRoles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl brand-gradient flex items-center justify-center text-white glow-sm">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold tracking-tight">Recommended for You</h2>
                        <p className="text-xs text-muted-foreground">
                          Roles with highest compatibility based on your skills & preferences
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary border-primary/20">
                      {recommendedRoles.length} Top {recommendedRoles.length === 1 ? "Match" : "Matches"}
                    </Badge>
                  </div>

                  {/* Recommended Roles Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {recommendedRoles.map((role) => (
                      <ProjectRoleCard
                        key={role.id}
                        role={role}
                        isRecommended={true}
                        scoreColor={getScoreColor(role.compatibility?.score || 0)}
                        scoreText={getScoreBadgeText(role.compatibility?.score || 0)}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 2: All Explore Roles */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold tracking-tight">
                      {recommendedRoles.length > 0 ? "All Open Opportunities" : "Browse Projects"}
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Showing {otherRoles.length + (recommendedRoles.length > 0 ? 0 : recommendedRoles.length)} roles
                  </span>
                </div>

                {/* If recommended was shown, show otherRoles here. If no recommended, show all filtered */}
                {recommendedRoles.length > 0 ? (
                  otherRoles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {otherRoles.map((role) => (
                        <ProjectRoleCard
                          key={role.id}
                          role={role}
                          isRecommended={false}
                          scoreColor={getScoreColor(role.compatibility?.score || 0)}
                          scoreText={getScoreBadgeText(role.compatibility?.score || 0)}
                          currentUserId={currentUserId}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      All matching open roles are listed in your recommendations above!
                    </p>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {roles.map((role) => (
                      <ProjectRoleCard
                        key={role.id}
                        role={role}
                        isRecommended={false}
                        scoreColor={getScoreColor(role.compatibility?.score || 0)}
                        scoreText={getScoreBadgeText(role.compatibility?.score || 0)}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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
}: {
  role: MatchedRole;
  isRecommended: boolean;
  scoreColor: string;
  scoreText: string;
  currentUserId?: string;
}) {
  const { toast } = useToast();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const isOwner = currentUserId === role.project.ownerId;
  const openSpots = role.headcount - role.filledCount;

  async function handleApply() {
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
        toast(`Applied to "${role.title}" successfully!`, "success");
      } else if (res.status === 409) {
        setApplied(true);
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
        "group flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card/70 backdrop-blur-sm border-border/60",
        isRecommended && "border-primary/40 shadow-sm hover:border-primary/70"
      )}
    >
      <CardHeader className="p-5 pb-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          {/* Project Type & Duration badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold py-0.5 px-2 bg-secondary/40">
              {role.project.projectType}
            </Badge>
            <Badge variant="outline" className="text-[10px] text-muted-foreground py-0.5 px-2 bg-secondary/20">
              <Clock className="w-3 h-3 mr-1 inline" />
              {role.project.duration}
            </Badge>
          </div>

          {/* Prominent Match Score in Top-Right */}
          {role.compatibility && role.compatibility.score > 0 && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm flex-shrink-0 transition-transform group-hover:scale-105",
                scoreColor
              )}
            >
              <Zap className="w-3 h-3 fill-current" />
              <span>{scoreText}</span>
            </div>
          )}
        </div>

        {/* Project Title & Role Title */}
        <div>
          <Link href={`/projects/${role.project.id}`}>
            <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-primary transition-colors cursor-pointer">
              {role.project.title}
            </CardTitle>
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <Briefcase className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground/90">{role.title}</span>
          </div>
        </div>

        {/* Snippet of Description */}
        <CardDescription className="text-xs line-clamp-2 text-muted-foreground leading-relaxed pt-1">
          {role.project.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4 flex-1">
        {/* Required Skills Row */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Required Skills
          </span>
          <div className="flex flex-wrap gap-1.5">
            {role.requiredSkills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="text-xs font-medium px-2 py-0.5 bg-secondary/60 hover:bg-secondary border-border/40"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        {/* Commitment & Headcount Specs */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>{role.timeCommitment}</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Users className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>
              {openSpots} {openSpots === 1 ? "spot open" : "spots open"}
            </span>
          </div>
        </div>

        {/* Granular Sub-score breakdown preview on hover (if recommended) */}
        {role.compatibility && isRecommended && (
          <div className="bg-primary/5 rounded-xl p-2.5 border border-primary/10 text-[11px] space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Skills Overlap</span>
              <span className="font-semibold text-foreground">
                {Math.round(role.compatibility.breakdown.skillOverlap * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Availability Fit</span>
              <span className="font-semibold text-foreground">
                {Math.round(role.compatibility.breakdown.availabilityFit * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Experience Fit</span>
              <span className="font-semibold text-foreground">
                {Math.round(role.compatibility.breakdown.experienceFit * 100)}%
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-5 pt-0 border-t border-border/40 mt-auto flex items-center justify-between">
        {/* Owner Info */}
        <div className="flex items-center gap-2 pt-3">
          <Avatar
            src={role.project.owner.image}
            alt={role.project.owner.name || "Owner"}
            size="sm"
            className="w-6 h-6 text-[10px]"
          />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground truncate max-w-[100px] block">
              {role.project.owner.name || "Project Lead"}
            </span>
            {role.project.owner.reputationScore !== undefined && (
              <ReputationBadge score={role.project.owner.reputationScore} size="xs" />
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 flex items-center gap-2">
          <Link href={`/projects/${role.project.id}`}>
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1">
              <span>Details</span>
              <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>

          {/* Apply button — hidden for role owners */}
          {!isOwner && (
            <Button
              size="sm"
              disabled={applying || applied}
              onClick={handleApply}
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
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Applied!</span>
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
