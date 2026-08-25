"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Briefcase,
  ExternalLink,
  UserCheck,
  Send,
  Filter,
  ChevronRight,
  AlertCircle,
  FolderOpen,
  Users,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { ReputationBadge } from "@/components/ratings/reputation-badge";

interface CandidateResult {
  id: string;
  name: string | null;
  email?: string | null;
  image?: string | null;
  skills: string[];
  interests: string[];
  availabilityHours: number | null;
  availabilityDuration: string | null;
  experienceLevel: string | null;
  reputationScore: number;
  portfolioLinks: string[];
  compatibility: {
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

interface RoleDetails {
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
    projectType: string;
    duration: string;
  };
}

export default function RoleCandidatesPage({
  params,
}: {
  params: Promise<{ id: string; roleId: string }>;
}) {
  const resolvedParams = use(params);
  const { id: projectId, roleId } = resolvedParams;

  const { status } = useSession();
  const { toast } = useToast();

  const [role, setRole] = useState<RoleDetails | null>(null);
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [invitingUsers, setInvitingUsers] = useState<Set<string>>(new Set());
  const [skillFilter, setSkillFilter] = useState<string>("");

  useEffect(() => {
    async function loadCandidates() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/matches/candidates?roleId=${roleId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load candidates");
        }
        const data = await res.json();
        setRole(data.role);
        setCandidates(data.results || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An error occurred while fetching candidates.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    if (status !== "loading") {
      loadCandidates();
    }
  }, [roleId, status]);

  const handleInvite = async (candidateId: string, candidateName: string) => {
    if (invitingUsers.has(candidateId) || invitedUsers.has(candidateId)) return;

    setInvitingUsers((prev) => new Set(prev).add(candidateId));
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId,
          actionType: "INVITE",
          candidateId,
        }),
      });
      const data = await res.json();
      if (res.status === 201) {
        setInvitedUsers((prev) => new Set(prev).add(candidateId));
        toast(`Invitation sent to ${candidateName}!`, "success");
      } else if (res.status === 409) {
        setInvitedUsers((prev) => new Set(prev).add(candidateId));
        toast(data.error || "This candidate has already been invited.", "info");
      } else if (res.status === 429) {
        toast("Too many invitations sent. Please wait before sending more.", "error");
      } else {
        toast(data.error || "Failed to send invitation. Please try again.", "error");
      }
    } catch {
      toast("Network error. Please check your connection.", "error");
    } finally {
      setInvitingUsers((prev) => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
    }
  };

  const getScoreBadge = (score: number) => {
    const percent = Math.round(score * 100);
    if (percent >= 80) {
      return {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        label: `${percent}% Match`,
        level: "Top Match",
      };
    }
    if (percent >= 50) {
      return {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        label: `${percent}% Match`,
        level: "Good Fit",
      };
    }
    return {
      bg: "bg-slate-500/10 border-slate-500/30 text-slate-400",
      label: `${percent}% Match`,
      level: "Partial Fit",
    };
  };

  const requiredSkillSet = new Set(
    (role?.requiredSkills || []).map((s) => s.toLowerCase().trim())
  );

  const filteredCandidates = candidates.filter((c) => {
    if (!skillFilter) return true;
    return c.skills.some((s) => s.toLowerCase().includes(skillFilter.toLowerCase()));
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Top Breadcrumbs & Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/projects" className="hover:text-primary transition-colors flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" />
              My Projects
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-primary transition-colors truncate max-w-[200px]"
            >
              {role?.project.title || "Project Details"}
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-foreground font-medium">Ranked Candidates</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Recommended Candidates
            </h1>
            <Badge variant="outline" className="brand-gradient text-white border-none font-semibold text-xs px-2.5 py-0.5">
              AI-Ranked
            </Badge>
          </div>
        </div>

        <Link href={`/projects/${projectId}`}>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Project
          </Button>
        </Link>
      </div>

      {/* Role Summary Banner */}
      {role && (
        <div className="bg-card/70 backdrop-blur-md rounded-2xl border border-border/60 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Target Role
              </div>
              <h2 className="text-xl font-bold text-foreground mt-0.5 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                {role.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Part of <span className="font-semibold text-foreground/90">{role.project.title}</span> • {role.project.projectType}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="px-3 py-1 bg-secondary/80">
                <Clock className="w-3.5 h-3.5 mr-1 inline text-primary" />
                {role.timeCommitment}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1 bg-secondary/80">
                Exp: {role.requiredExperienceLevel}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1 bg-secondary/80">
                Spots: {role.headcount - role.filledCount} of {role.headcount} Open
              </Badge>
            </div>
          </div>

          {/* Required Skills Row */}
          <div className="pt-3 border-t border-border/40 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              Required Skills:
            </span>
            {role.requiredSkills.map((skill) => (
              <Badge
                key={skill}
                variant="default"
                className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30 text-xs font-semibold px-2.5 py-0.5"
              >
                <CheckCircle2 className="w-3 h-3 mr-1 inline text-primary" />
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Candidate List Area */}
      <div className="space-y-6">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/30 p-4 rounded-xl border border-border/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              {candidates.length} Ranked Candidate{candidates.length === 1 ? "" : "s"} Found
            </span>
          </div>

          {/* Quick Skill search */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by candidate skill..."
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="text-xs bg-background/70 border border-border/60 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
            {skillFilter && (
              <button
                onClick={() => setSkillFilter("")}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-8 text-center bg-destructive/10 border border-destructive/30 rounded-2xl">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-destructive mb-1">Access Restricted</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse bg-card/40 border-border/40 p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted/60" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-40 bg-muted/70 rounded" />
                    <div className="h-3 w-28 bg-muted/50 rounded" />
                  </div>
                  <div className="h-8 w-24 bg-muted/60 rounded-full" />
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-16 bg-muted/60 rounded-md" />
                  <div className="h-6 w-20 bg-muted/60 rounded-md" />
                  <div className="h-6 w-14 bg-muted/60 rounded-md" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty Candidates State */}
        {!loading && !error && filteredCandidates.length === 0 && (
          <div className="p-12 text-center bg-card/30 rounded-2xl border border-dashed border-border/60">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No Matching Candidates Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {skillFilter
                ? `No candidates found with skill "${skillFilter}". Try clearing your search.`
                : "There are currently no registered users matching the requirements for this role."}
            </p>
          </div>
        )}

        {/* Stacked List of Candidate Cards */}
        {!loading && !error && filteredCandidates.length > 0 && (
          <div className="space-y-4">
            {filteredCandidates.map((candidate, index) => {
              const scoreInfo = getScoreBadge(candidate.compatibility.score);
              const isTopMatch = index === 0;
              const isInvited = invitedUsers.has(candidate.id);
              const isInviting = invitingUsers.has(candidate.id);

              return (
                <Card
                  key={candidate.id}
                  className={cn(
                    "transition-all duration-200 bg-card/70 backdrop-blur-sm border-border/60 hover:shadow-lg hover:border-primary/40",
                    isTopMatch && "border-primary/50 shadow-md bg-card/90"
                  )}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      {/* Left Column: Avatar + Basic Details */}
                      <div className="flex items-start gap-4 flex-1">
                        <Avatar
                          src={candidate.image}
                          alt={candidate.name || "Candidate"}
                          size="lg"
                          className="ring-2 ring-primary/20"
                        />

                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-foreground">
                              {candidate.name || "Anonymous Candidate"}
                            </h3>

                            {/* Experience Badge */}
                            <Badge variant="outline" className="text-xs bg-secondary/50 font-medium">
                              {candidate.experienceLevel || "Mid-Level"}
                            </Badge>

                            {/* Top Match Ribbon */}
                            {isTopMatch && (
                              <Badge className="brand-gradient text-white text-[10px] font-bold uppercase tracking-wider py-0.5 px-2">
                                #1 Top Match
                              </Badge>
                            )}
                          </div>

                          {/* Reputation & Availability Info */}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            {/* Reputation Score */}
                            <ReputationBadge
                              score={candidate.reputationScore}
                              showLabel
                              size="sm"
                            />

                            {/* Availability Hours */}
                            {candidate.availabilityHours && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                                <span>{candidate.availabilityHours} hrs/week</span>
                              </div>
                            )}

                            {/* Availability Duration */}
                            {candidate.availabilityDuration && (
                              <div className="flex items-center gap-1">
                                <span>• {candidate.availabilityDuration}</span>
                              </div>
                            )}
                          </div>

                          {/* Candidate Skills with Visual Hierarchy */}
                          <div className="pt-2 space-y-1.5">
                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                              Skills (Highlighted = Perfect Role Match)
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {candidate.skills.map((skill) => {
                                const isMatched = requiredSkillSet.has(
                                  skill.toLowerCase().trim()
                                );

                                return (
                                  <Badge
                                    key={skill}
                                    variant={isMatched ? "default" : "secondary"}
                                    className={cn(
                                      "text-xs px-2.5 py-0.5 transition-all",
                                      isMatched
                                        ? "brand-gradient text-white shadow-sm font-semibold border-none"
                                        : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary"
                                    )}
                                  >
                                    {isMatched && (
                                      <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                                    )}
                                    {skill}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>

                          {/* Candidate Interests */}
                          {candidate.interests && candidate.interests.length > 0 && (
                            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                Interests:
                              </span>
                              {candidate.interests.map((interest) => (
                                <span
                                  key={interest}
                                  className="bg-secondary/30 px-2 py-0.5 rounded text-[11px] border border-border/30"
                                >
                                  {interest}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Portfolio Links */}
                          {candidate.portfolioLinks && candidate.portfolioLinks.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-2">
                              {candidate.portfolioLinks.map((link, i) => (
                                <a
                                  key={i}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Portfolio Link {i + 1}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Score Breakdown + Action Button */}
                      <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-border/40 min-w-[200px]">
                        {/* Prominent Match Score */}
                        <div className="text-left lg:text-right">
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border shadow-sm font-bold text-sm",
                              scoreInfo.bg
                            )}
                          >
                            <Zap className="w-4 h-4 fill-current" />
                            <span>{scoreInfo.label}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {scoreInfo.level}
                          </p>
                        </div>

                        {/* Granular Sub-Score Mini Breakdown */}
                        <div className="w-full bg-secondary/30 p-2.5 rounded-xl border border-border/40 text-[11px] space-y-1 text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Skills Overlap:</span>
                            <span className="font-semibold text-foreground">
                              {Math.round(candidate.compatibility.breakdown.skillOverlap * 100)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Availability:</span>
                            <span className="font-semibold text-foreground">
                              {Math.round(candidate.compatibility.breakdown.availabilityFit * 100)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Experience:</span>
                            <span className="font-semibold text-foreground">
                              {Math.round(candidate.compatibility.breakdown.experienceFit * 100)}%
                            </span>
                          </div>
                        </div>

                        {/* Invite / Action Button */}
                        <Button
                          onClick={() => handleInvite(candidate.id, candidate.name || "Candidate")}
                          disabled={isInvited || isInviting}
                          size="sm"
                          className={cn(
                            "w-full font-semibold text-xs gap-1.5 shadow-sm transition-all",
                            isInvited
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "brand-gradient text-white hover:opacity-95"
                          )}
                        >
                          {isInviting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : isInvited ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Invite Sent</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Invite Candidate</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
