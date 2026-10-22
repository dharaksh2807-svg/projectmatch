"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  UserPlus,
  Sparkles,
  Layers,
  RefreshCw,
  Plus,
  Pencil,
  Info,
  Clock,
  Briefcase,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { RequirementModal } from "./requirement-modal";
import {
  TeamGapAnalysisResult,
  ComplementaryCandidateRecommendation,
  ProjectCapabilityItem,
  CapabilityStatus,
} from "@/lib/gap-analyzer";

interface TeamSkillGapDashboardProps {
  projectId: string;
  projectTitle: string;
  isOwner: boolean;
  onInviteCandidate?: (candidateId: string, roleId: string | null) => void;
}

export function TeamSkillGapDashboard({
  projectId,
  isOwner,
  onInviteCandidate,
}: TeamSkillGapDashboardProps) {

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    gapAnalysis: TeamGapAnalysisResult;
    recommendations: ComplementaryCandidateRecommendation[];
    isOwner: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter state for capabilities
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal state for adding/editing requirements
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<ProjectCapabilityItem | null>(null);

  // Expanded explanations toggle per candidate
  const [expandedCandidates, setExpandedCandidates] = useState<Record<string, boolean>>({});

  const fetchGapAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/gaps`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You are not authorized to view this team's skill-gap analysis.");
        }
        throw new Error("Failed to load skill-gap analysis.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchGapAnalysis();
    }
  }, [projectId]);

  const toggleCandidateExpand = (candidateId: string) => {
    setExpandedCandidates((prev) => ({
      ...prev,
      [candidateId]: !prev[candidateId],
    }));
  };

  const filteredCapabilities = useMemo(() => {
    if (!data?.gapAnalysis) return [];
    if (statusFilter === "ALL") return data.gapAnalysis.capabilities;
    if (statusFilter === "GAPS") {
      return data.gapAnalysis.capabilities.filter(
        (c) => c.status === "MISSING" || c.status === "PARTIALLY_COVERED"
      );
    }
    return data.gapAnalysis.capabilities.filter((c) => c.status === statusFilter);
  }, [data, statusFilter]);

  if (loading) {
    return (
      <Card className="border-border/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Analyzing team capability coverage and candidate complement...
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-border/60 p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <h3 className="font-semibold text-base">Skill-Gap Analysis Unavailable</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchGapAnalysis} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </Button>
      </Card>
    );
  }

  const { gapAnalysis, recommendations } = data;

  const renderStatusBadge = (status: CapabilityStatus) => {
    switch (status) {
      case "COVERED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1 font-medium text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Covered
          </Badge>
        );
      case "PARTIALLY_COVERED":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 font-medium text-xs">
            <AlertTriangle className="w-3.5 h-3.5" /> Partially Covered
          </Badge>
        );
      case "MISSING":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 gap-1 font-medium text-xs">
            <XCircle className="w-3.5 h-3.5" /> Missing
          </Badge>
        );
      case "UNKNOWN":
      default:
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30 gap-1 font-medium text-xs">
            <HelpCircle className="w-3.5 h-3.5" /> Unknown Data
          </Badge>
        );
    }
  };

  const renderClassificationBadge = (classification: string) => {
    switch (classification) {
      case "STRONG_COMPLEMENT":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
            Strong Complement
          </Badge>
        );
      case "MODERATE_COMPLEMENT":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
            Fills Team Gap
          </Badge>
        );
      case "REDUNDANT":
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 text-[11px]">
            Redundant Skills
          </Badge>
        );
      case "POTENTIAL_FIT":
        return (
          <Badge className="bg-muted text-muted-foreground text-[11px]">
            Role Fit
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground text-[11px]">
            Profile Incomplete
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Overview Banner ────────────────────────────────────────────── */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Layers className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Team Skill-Gap Analyzer
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Deterministic capability audit against explicitly defined project needs and explainable candidate matching.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchGapAnalysis}
                className="gap-1 text-xs cursor-pointer"
                title="Refresh analysis"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>

              {isOwner && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingReq(null);
                    setIsReqModalOpen(true);
                  }}
                  className="brand-gradient text-white gap-1 text-xs cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Requirement
                </Button>
              )}
            </div>
          </div>

          {/* Categorical Status Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="p-3 bg-card border border-border/60 rounded-lg">
              <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Covered</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {gapAnalysis.coveredCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {gapAnalysis.totalRequirements}
                </span>
              </div>
            </div>

            <div className="p-3 bg-card border border-border/60 rounded-lg">
              <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Partially Covered</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {gapAnalysis.partiallyCoveredCount}
              </div>
            </div>

            <div className="p-3 bg-card border border-border/60 rounded-lg">
              <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Missing Capabilities</span>
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {gapAnalysis.missingCount}
              </div>
            </div>

            <div className="p-3 bg-card border border-border/60 rounded-lg">
              <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                <span>Unknown / Incomplete</span>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-600 dark:text-slate-400 mt-1">
                {gapAnalysis.unknownCount}
              </div>
            </div>
          </div>

          {/* Redundancy & Concentration Banner */}
          {gapAnalysis.redundancy.level !== "NO_REDUNDANCY" && (
            <div
              className={`mt-3 p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                gapAnalysis.redundancy.level === "HIGH_CONCENTRATION"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300"
              }`}
            >
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold">
                  {gapAnalysis.redundancy.level === "HIGH_CONCENTRATION"
                    ? "Skill Concentration Note: "
                    : "Team Skill Redundancy: "}
                </span>
                {gapAnalysis.redundancy.explanation}
              </div>
            </div>
          )}
        </div>

        {/* ── Section 1: Team Overview ────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Team Overview ({gapAnalysis.teamMembers.length} Members, {gapAnalysis.openPositions.length} Open Positions)
            </h3>
          </div>

          {/* Members List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gapAnalysis.teamMembers.map((member) => (
              <div
                key={member.id}
                className="p-3.5 rounded-lg border border-border/60 bg-card/60 flex items-start gap-3"
              >
                <Avatar
                  src={member.image}
                  alt={member.name || "Member"}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate text-foreground">
                      {member.name || "Teammate"}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {member.roleTitle}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <ReputationBadge score={member.reputationScore} size="sm" />
                    {member.experienceLevel && (
                      <span className="text-[11px] text-muted-foreground">
                        • {member.experienceLevel}
                      </span>
                    )}
                    {member.weeklyHours && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        • <Clock className="w-3 h-3" /> {member.weeklyHours}h/wk
                      </span>
                    )}
                  </div>

                  {/* Skills tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {member.skills && member.skills.length > 0 ? (
                      member.skills.slice(0, 5).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded-xs bg-muted text-[10px] text-muted-foreground font-mono"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                        No skills declared on profile
                      </span>
                    )}
                    {member.skills && member.skills.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{member.skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Open Positions List */}
          {gapAnalysis.openPositions.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-primary" /> Active Open Roles
              </h4>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis.openPositions.map((role) => (
                  <div
                    key={role.id}
                    className="p-2.5 rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{role.title}</span>
                      <span className="text-muted-foreground ml-1.5">
                        ({role.spotsRemaining} spots open)
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {role.requiredExperienceLevel}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Section 2: Capability Coverage ──────────────────────────────────── */}
      <Card className="border-border/70 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Capability Coverage Analysis
            </h3>
            <p className="text-xs text-muted-foreground">
              Evaluated against explicit and derived project needs with evidence distinction.
            </p>
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs self-start">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === "ALL"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({gapAnalysis.totalRequirements})
            </button>
            <button
              onClick={() => setStatusFilter("GAPS")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === "GAPS"
                  ? "bg-card text-rose-600 dark:text-rose-400 font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gaps ({gapAnalysis.missingCount + gapAnalysis.partiallyCoveredCount})
            </button>
            <button
              onClick={() => setStatusFilter("COVERED")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === "COVERED"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Covered ({gapAnalysis.coveredCount})
            </button>
          </div>
        </div>

        {/* Capability Cards */}
        <div className="space-y-3">
          {filteredCapabilities.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground text-xs">
              No capabilities matching the selected filter.
            </div>
          ) : (
            filteredCapabilities.map((cap) => (
              <div
                key={cap.id}
                className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3 transition-colors hover:border-border"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(cap.status)}
                    <h4 className="font-semibold text-sm text-foreground">
                      {cap.name}
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold ${
                        cap.importance === "REQUIRED"
                          ? "border-primary/40 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {cap.importance}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {cap.minExperienceLevel && (
                      <span className="text-muted-foreground">
                        Min. Level: <strong className="text-foreground">{cap.minExperienceLevel}</strong>
                      </span>
                    )}

                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingReq({
                            id: cap.id,
                            name: cap.name,
                            category: cap.category,
                            importance: cap.importance,
                            requiredSkills: cap.requiredSkills,
                            minExperienceLevel: cap.minExperienceLevel,
                            targetRoleTitle: cap.targetRoleTitle,
                            isCustom: !cap.id.startsWith("derived-"),
                          });
                          setIsReqModalOpen(true);
                        }}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </div>

                {/* Skills requirements */}
                <div className="text-xs space-y-1.5 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground font-medium">Required Skills:</span>
                    {cap.requiredSkills.map((skill, idx) => {
                      const isCovered = cap.coveredSkills.some(
                        (s) => s.toLowerCase() === skill.toLowerCase()
                      );
                      return (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                            isCovered
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {isCovered ? "✓ " : "✗ "}
                          {skill}
                        </span>
                      );
                    })}
                  </div>

                  {/* Reasons / Explanation */}
                  <div className="pt-1 text-xs text-muted-foreground">
                    {cap.evidence.reasons.map((reason, idx) => (
                      <p key={idx} className="leading-relaxed">
                        • {reason}
                      </p>
                    ))}
                  </div>

                  {/* Capacity warning if single contributor */}
                  {cap.capacityWarning && (
                    <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{cap.capacityWarning}</span>
                    </div>
                  )}

                  {/* Evidence breakdown */}
                  {(cap.evidence.selfReported.length > 0 || cap.evidence.independentlySupported.length > 0) && (
                    <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] border-t border-border/40 mt-2">
                      {cap.evidence.selfReported.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-muted-foreground">
                            Self-Reported Claims:
                          </span>
                          {cap.evidence.selfReported.map((ev, idx) => (
                            <div key={idx} className="text-muted-foreground">
                              - {ev}
                            </div>
                          ))}
                        </div>
                      )}
                      {cap.evidence.independentlySupported.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Independently Supported:
                          </span>
                          {cap.evidence.independentlySupported.map((ev, idx) => (
                            <div key={idx} className="text-foreground">
                              - {ev}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ── Section 3: Recruitment Priorities & Complementary Recommendations ── */}
      <Card className="border-border/70 p-5 sm:p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Recruitment Recommendations & Priorities
          </h3>
          <p className="text-xs text-muted-foreground">
            Prioritized recruitment actions to close open gaps and recommend complementary candidates.
          </p>
        </div>

        {/* Priority Action Items */}
        {gapAnalysis.recruitmentPriorities.length > 0 ? (
          <div className="space-y-2.5">
            {gapAnalysis.recruitmentPriorities.slice(0, 3).map((item) => (
              <div
                key={item.priority}
                className="p-3 rounded-lg border border-border/70 bg-card/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      item.urgency === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                        : item.urgency === "HIGH"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {item.priority}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {item.capabilityName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          item.urgency === "CRITICAL"
                            ? "border-rose-500 text-rose-500"
                            : item.urgency === "HIGH"
                            ? "border-amber-500 text-amber-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.urgency}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.rationale}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground font-medium pl-8 sm:pl-0">
                  {item.suggestedAction}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>All project capabilities are covered! No urgent recruitment gaps detected.</span>
          </div>
        )}

        {/* ── Complementary Candidate Matches ─────────────────────────────────── */}
        <div className="pt-4 border-t border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">
                Complementary Candidates for Open Roles
              </h4>
            </div>
            <span className="text-xs text-muted-foreground">
              Ranked with gap-complement bonus
            </span>
          </div>

          {recommendations.length === 0 ? (
            <div className="p-6 text-center border border-dashed rounded-lg text-muted-foreground text-xs">
              No complementary candidates available for the current open roles.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {recommendations.map((rec) => {
                const isExpanded = !!expandedCandidates[rec.user.id];
                return (
                  <div
                    key={rec.user.id}
                    className="p-4 rounded-xl border border-border/80 bg-card shadow-2xs space-y-3 transition-colors hover:border-primary/40"
                  >
                    {/* Candidate Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={rec.user.image}
                          alt={rec.user.name || "Candidate"}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {rec.user.name || "Candidate"}
                            </span>
                            {renderClassificationBadge(rec.explanation.classification)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <ReputationBadge score={rec.user.reputationScore} size="sm" />
                            {rec.user.experienceLevel && (
                              <span>• {rec.user.experienceLevel}</span>
                            )}
                            {rec.user.availability && (
                              <span>• {rec.user.availability}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Best Role Match & Score */}
                      <div className="flex items-center gap-2 sm:self-center">
                        <div className="text-right">
                          <div className="text-xs font-semibold text-foreground">
                            Best Match: {rec.bestRoleMatch.roleTitle}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Compatibility:{" "}
                            <strong className="text-primary font-bold">
                              {Math.round(rec.bestRoleMatch.score * 100)}%
                            </strong>
                            {rec.explanation.complementBonus > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1">
                                (+{Math.round(rec.explanation.complementBonus * 100)}% gap bonus)
                              </span>
                            )}
                          </div>
                        </div>

                        {isOwner && onInviteCandidate && (
                          <Button
                            size="sm"
                            onClick={() => onInviteCandidate(rec.user.id, rec.bestRoleMatch.roleId)}
                            className="brand-gradient text-white text-xs gap-1 cursor-pointer shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Invite
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Summary reason */}
                    <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 leading-relaxed">
                      💡 {rec.explanation.summaryReason}
                    </p>

                    {/* Matched skills tags */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground font-medium">Matches:</span>
                      {rec.explanation.matchedRequiredSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-mono"
                        >
                          ✓ {skill}
                        </span>
                      ))}
                      {rec.explanation.missingRequiredSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-mono"
                        >
                          missing {skill}
                        </span>
                      ))}

                      {/* Toggle expanded explanation */}
                      <button
                        onClick={() => toggleCandidateExpand(rec.user.id)}
                        className="ml-auto text-xs text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            Less details <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Why this match? <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expanded Evidence Breakdown */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-lg">
                        {/* Verified Facts */}
                        <div>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Verified Facts & Evidence
                          </div>
                          {rec.explanation.evidence.verifiedFacts.length > 0 ? (
                            <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
                              {rec.explanation.evidence.verifiedFacts.map((fact, idx) => (
                                <li key={idx}>{fact}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              No peer ratings or past projects recorded yet.
                            </span>
                          )}
                        </div>

                        {/* Inferred & Self-reported */}
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1 mb-1">
                            <Info className="w-3.5 h-3.5 text-primary" /> Fit & Capability Overlap
                          </div>
                          <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
                            {rec.explanation.evidence.inferredCompatibility.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                            {rec.explanation.evidence.unmetCriteria.map((item, idx) => (
                              <li key={idx} className="text-amber-600 dark:text-amber-400">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ── Section 4: Improve Team Profile ─────────────────────────────────── */}
      {gapAnalysis.profileCompleteness.hasIncompleteProfiles && (
        <Card className="border-border/60 p-4 bg-muted/20 flex items-start gap-3 text-xs">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-foreground">
              Tip for accurate team analysis:
            </span>
            {gapAnalysis.profileCompleteness.recommendations.map((rec, idx) => (
              <p key={idx} className="text-muted-foreground">
                • {rec}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* Requirement Modal */}
      <RequirementModal
        isOpen={isReqModalOpen}
        onClose={() => {
          setIsReqModalOpen(false);
          setEditingReq(null);
        }}
        projectId={projectId}
        requirement={editingReq}
        onSuccess={fetchGapAnalysis}
      />
    </div>
  );
}
