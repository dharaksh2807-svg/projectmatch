"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Calendar,
  ExternalLink,
  Users,
  Search,
  Sparkles,
  ArrowRight,
  Plus,
  Loader2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

interface HackathonProject {
  id: string;
  title: string;
  projectType: string;
  owner: {
    name: string | null;
    image: string | null;
  };
  roles: {
    id: string;
    title: string;
    requiredSkills: string[];
  }[];
}

interface HackathonItem {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  devpostUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
  _count: {
    projects: number;
  };
  projects: HackathonProject[];
}

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

const CATEGORY_FILTERS = ["All", "Virtual", "In-Person", "AI & ML", "Web3"];

export default function HackathonsPage() {
  const { toast } = useToast();
  const [hackathons, setHackathons] = useState<HackathonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // AI Matchmaker State
  const [aiMatches, setAiMatches] = useState<AIMatchItem[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  useEffect(() => {
    async function loadHackathons() {
      setLoading(true);
      try {
        const res = await fetch("/api/hackathons");
        if (res.ok) {
          const data = await res.json();
          setHackathons(data);
        }
      } catch (err) {
        console.error("Failed to load hackathons:", err);
        toast("Failed to load hackathons", "error");
      } finally {
        setLoading(false);
      }
    }

    loadHackathons();
  }, [toast]);

  // Load AI Matches on Demand
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

  // Filter hackathons
  const filteredHackathons = useMemo(() => {
    return hackathons.filter((h) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        h.name.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q)) ||
        (h.location && h.location.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedCategory === "Virtual") {
        return (
          h.location?.toLowerCase().includes("virtual") ||
          h.location?.toLowerCase().includes("online")
        );
      }
      if (selectedCategory === "In-Person") {
        return (
          h.location &&
          !h.location.toLowerCase().includes("virtual") &&
          !h.location.toLowerCase().includes("online")
        );
      }
      if (selectedCategory === "AI & ML") {
        return (
          h.name.toLowerCase().includes("ai") ||
          h.name.toLowerCase().includes("genai") ||
          (h.description && h.description.toLowerCase().includes("ai"))
        );
      }
      if (selectedCategory === "Web3") {
        return (
          h.name.toLowerCase().includes("eth") ||
          h.name.toLowerCase().includes("crypto") ||
          (h.description && h.description.toLowerCase().includes("decentralized"))
        );
      }

      return true;
    });
  }, [hackathons, searchQuery, selectedCategory]);

  const formatDateRange = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return "Dates TBA";
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : null;

    const startFormatted = start.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });

    if (!end) return startFormatted;

    const endFormatted = end.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${startFormatted} – ${endFormatted}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in font-sans">
      {/* ─────────────────────────────────────────────────────────────
          HERO BANNER
          ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950/40 p-6 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5" />
            Hackathon Arena
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Find Your Winning Hackathon Team
          </h1>

          <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
            Browse upcoming premier hackathons, discover projects actively seeking builders, or launch your own squad to win together.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              onClick={handleLoadAiMatches}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm gap-2 shadow-lg shadow-emerald-900/20"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              {loadingAi ? "Analyzing Skills with Gemini..." : "AI Hackathon Matchmaker"}
            </Button>

            <Link href="/projects/new">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 text-xs sm:text-sm gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Pitch a Project
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          AI MATCHMAKER RECOMMENDATIONS (EXPANDABLE)
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
                  Ranked by Gemini AI comparing your profile skills against project requirements
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
          SEARCH & CATEGORY FILTERS
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by hackathon name, city, or topic..."
            className="pl-9 bg-card/60 text-sm h-10 border-border/70 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          HACKATHON GRID
          ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-border/60 p-5 space-y-4">
              <Skeleton className="h-6 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-16 w-full rounded" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredHackathons.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="No Hackathons Found"
          description="Try clearing your search query or switching categories to discover other hackathons."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery("");
            setSelectedCategory("All");
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHackathons.map((h) => {
            const hasRecruitingProjects = h.projects && h.projects.length > 0;
            const projectCount = h._count?.projects || 0;

            return (
              <Card
                key={h.id}
                className="flex flex-col justify-between border-border/70 bg-card/70 backdrop-blur-sm hover:border-emerald-500/40 hover:shadow-xl transition-all duration-200 group overflow-hidden"
              >
                {/* Decorative Top Accent Line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-primary group-hover:h-2 transition-all" />

                <CardHeader className="p-5 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] px-2 py-0.5"
                    >
                      {h.location || "Global Virtual"}
                    </Badge>

                    {projectCount > 0 && (
                      <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                        <Users className="w-3 h-3" />
                        {projectCount} {projectCount === 1 ? "Team" : "Teams"} Recruiting
                      </span>
                    )}
                  </div>

                  <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {h.name}
                  </CardTitle>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                    <span>{formatDateRange(h.startDate, h.endDate)}</span>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {h.description || "Join fellow hackers and innovators to build revolutionary projects."}
                  </p>

                  {/* Teammates Seeking Teammates Preview */}
                  {hasRecruitingProjects && (
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                        Open Project Roles:
                      </span>
                      <div className="space-y-1">
                        {h.projects.map((p) => (
                          <Link
                            key={p.id}
                            href={`/projects/${p.id}`}
                            className="text-xs text-foreground hover:text-primary flex items-center justify-between gap-1 transition-colors truncate"
                          >
                            <span className="truncate">{p.title}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {p.roles.length} {p.roles.length === 1 ? "role" : "roles"}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="p-5 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {h.websiteUrl && (
                      <a
                        href={h.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
                        title="Official Website"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Website</span>
                      </a>
                    )}
                    {h.devpostUrl && (
                      <a
                        href={h.devpostUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-950/40 transition-colors"
                        title="Devpost Page"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Devpost</span>
                      </a>
                    )}
                  </div>

                  <Link href={`/discover?projectType=Hackathon`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 gap-1 hover:text-primary hover:bg-primary/10"
                    >
                      Find Team
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
