"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Briefcase,
  FolderOpen,
  Send,
  Loader2,
  ChevronRight,
  UserCheck,
  Check,
  X,
  MessageSquare,
  Search,
  ExternalLink,
  Globe,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ReceivedApplicant {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    skills: string[];
    experienceLevel: string | null;
    bio: string | null;
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    twitterHandle: string | null;
    reputationScore: number;
  };
  role: {
    id: string;
    title: string;
    requiredSkills: string[];
    timeCommitment: string;
    requiredExperienceLevel: string;
    headcount: number;
    filledCount: number;
    isOpen: boolean;
  };
  project: {
    id: string;
    title: string;
    projectType: string;
    ownerId: string;
  };
}

interface SentApplication {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  createdAt: string;
  role: {
    id: string;
    title: string;
    requiredSkills: string[];
    timeCommitment: string;
    requiredExperienceLevel: string;
  };
  project: {
    id: string;
    title: string;
    projectType: string;
    owner: {
      id?: string;
      name: string | null;
      image: string | null;
      email?: string | null;
    };
  };
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending Review",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  ACCEPTED: {
    label: "Accepted",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    icon: XCircle,
    className: "bg-muted/10 text-muted-foreground border-muted/30",
  },
};

export default function ApplicationsPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [receivedApps, setReceivedApps] = useState<ReceivedApplicant[]>([]);
  const [sentApps, setSentApps] = useState<SentApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Action states
  const [actingOn, setActingOn] = useState<Set<string>>(new Set());
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);

  // Filters for Received Applicants
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  // Load received applications for project owner
  async function loadReceivedApplications() {
    try {
      const res = await fetch("/api/applications?type=received");
      if (res.ok) {
        const data = await res.json();
        setReceivedApps(data || []);
      }
    } catch (err) {
      console.error("Failed to load received applications:", err);
    }
  }

  // Load sent applications submitted by the user
  async function loadSentApplications() {
    try {
      const res = await fetch("/api/applications?type=sent");
      if (res.ok) {
        const data = await res.json();
        setSentApps(data || []);
      }
    } catch (err) {
      console.error("Failed to load sent applications:", err);
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadReceivedApplications(), loadSentApplications()]);
      setLoading(false);
    }

    if (sessionStatus !== "loading") {
      init();
    }
  }, [sessionStatus]);

  // Handle Accept / Reject (Project Owner)
  async function handleDecision(applicationId: string, decision: "ACCEPTED" | "REJECTED") {
    setActingOn((prev) => new Set(prev).add(applicationId));
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision }),
      });

      const data = await res.json();
      if (res.ok) {
        toast(
          decision === "ACCEPTED"
            ? "Applicant accepted! A direct conversation has been opened."
            : "Application marked as rejected.",
          decision === "ACCEPTED" ? "success" : "info"
        );
        // Refresh local state
        setReceivedApps((prev) =>
          prev.map((app) =>
            app.id === applicationId ? { ...app, status: decision } : app
          )
        );
      } else {
        toast(data.error || "Action failed. Please try again.", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setActingOn((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    }
  }

  // Start Direct Chat with Applicant
  async function handleDirectChat(userId: string, projectId?: string) {
    setMessagingUserId(userId);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      });

      if (res.ok) {
        const conversation = await res.json();
        router.push(`/messages?c=${conversation.id}`);
      } else {
        const data = await res.json();
        toast(data.error || "Could not open chat", "error");
      }
    } catch {
      toast("Error creating conversation", "error");
    } finally {
      setMessagingUserId(null);
    }
  }

  // Handle Withdraw (Applicant)
  async function handleWithdraw(applicationId: string) {
    setActingOn((prev) => new Set(prev).add(applicationId));
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "WITHDRAWN" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Application withdrawn successfully.", "success");
        setSentApps((prev) =>
          prev.map((a) => (a.id === applicationId ? { ...a, status: "WITHDRAWN" } : a))
        );
      } else {
        toast(data.error || "Action failed. Please try again.", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setActingOn((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    }
  }

  // Unique project titles for filter dropdown
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    receivedApps.forEach((app) => {
      map.set(app.project.id, app.project.title);
    });
    return Array.from(map.entries());
  }, [receivedApps]);

  // Filtered Received Applicants
  const filteredReceivedApps = useMemo(() => {
    return receivedApps.filter((app) => {
      if (statusFilter !== "ALL" && app.status !== statusFilter) return false;
      if (projectFilter !== "ALL" && app.project.id !== projectFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const userName = app.user.name?.toLowerCase() || "";
        const roleTitle = app.role.title.toLowerCase();
        const projectTitle = app.project.title.toLowerCase();
        const skills = (app.user.skills || []).map((s) => s.toLowerCase()).join(" ");
        return (
          userName.includes(q) ||
          roleTitle.includes(q) ||
          projectTitle.includes(q) ||
          skills.includes(q)
        );
      }
      return true;
    });
  }, [receivedApps, statusFilter, projectFilter, searchFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = receivedApps.length;
    const pending = receivedApps.filter((a) => a.status === "PENDING").length;
    const accepted = receivedApps.filter((a) => a.status === "ACCEPTED").length;
    const rejected = receivedApps.filter((a) => a.status === "REJECTED").length;
    return { total, pending, accepted, rejected };
  }, [receivedApps]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in font-sans">
      {/* ─────────────────────────────────────────────────────────────
          HEADER & NAVIGATION
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/dashboard" className="hover:text-primary flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-foreground font-medium">Applications & Review</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-emerald-500" />
            Applications Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review candidate applications for your projects and track applications you’ve submitted.
          </p>
        </div>

        {/* Primary Tabs Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/60 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("received")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
              activeTab === "received"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            Review Applicants
            {metrics.pending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                {metrics.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("sent")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
              activeTab === "sent"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Send className="w-3.5 h-3.5 text-primary" />
            My Sent Applications ({sentApps.length})
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: REVIEW APPLICANTS (PROJECT OWNERS)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "received" && (
        <div className="space-y-6">
          {/* Summary Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-1">
              <span className="text-xs text-muted-foreground">Total Applicants</span>
              <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-1">
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Pending Review
              </span>
              <p className="text-2xl font-bold text-amber-400">{metrics.pending}</p>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-1">
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Accepted Teammates
              </span>
              <p className="text-2xl font-bold text-emerald-400">{metrics.accepted}</p>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-1">
              <span className="text-xs text-muted-foreground">Acceptance Rate</span>
              <p className="text-2xl font-bold text-foreground">
                {metrics.total > 0
                  ? `${Math.round((metrics.accepted / metrics.total) * 100)}%`
                  : "0%"}
              </p>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-3.5 rounded-2xl border border-border/60">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search applicants, roles, or skills..."
                className="pl-9 h-9 text-xs bg-background/80"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Project Filter */}
              {uniqueProjects.length > 1 && (
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="h-9 px-3 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Projects</option>
                  {uniqueProjects.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              )}

              {/* Status Filter */}
              <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/60">
                {["ALL", "PENDING", "ACCEPTED", "REJECTED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                      statusFilter === st
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {st === "ALL" ? "All" : st[0] + st.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Applicant Cards List */}
          {filteredReceivedApps.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No applicants found"
              description={
                receivedApps.length === 0
                  ? "You don't have any applications for your projects yet. Make sure your projects have published open roles!"
                  : "No applicants matched your current filter criteria."
              }
              actionLabel={receivedApps.length === 0 ? "View My Projects" : "Reset Filters"}
              onAction={() => {
                setStatusFilter("ALL");
                setProjectFilter("ALL");
                setSearchFilter("");
              }}
              actionHref={receivedApps.length === 0 ? "/projects" : undefined}
            />
          ) : (
            <div className="space-y-4">
              {filteredReceivedApps.map((app) => {
                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = cfg.icon;
                const isActing = actingOn.has(app.id);
                const isMessaging = messagingUserId === app.user.id;

                // Match skills comparison
                const candidateSkills = app.user.skills || [];
                const requiredSkills = app.role.requiredSkills || [];

                return (
                  <Card
                    key={app.id}
                    className="border-border/70 bg-card/70 backdrop-blur-sm overflow-hidden hover:border-border transition-all shadow-sm"
                  >
                    <CardContent className="p-5 md:p-6 space-y-4">
                      {/* Top Row: Candidate Info & Target Role */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <Avatar
                            src={app.user.image || undefined}
                            alt={app.user.name || "Candidate"}
                            size="md"
                            className="ring-1 ring-border shrink-0 mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-base text-foreground truncate">
                                {app.user.name || "Anonymous Builder"}
                              </h3>
                              {app.user.experienceLevel && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-2 py-0 border-primary/30 text-primary"
                                >
                                  {app.user.experienceLevel}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {app.user.email || "Contact via Direct Message"}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge & Project Target */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <div className="text-right hidden sm:block">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block">
                              Applying for:
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                              {app.role.title} • {app.project.title}
                            </span>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn("text-xs px-2.5 py-1 border gap-1.5 shrink-0", cfg.className)}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Candidate Pitch / Cover Message */}
                      {app.message && (
                        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-foreground/90 italic leading-relaxed">
                          &ldquo;{app.message}&rdquo;
                        </div>
                      )}

                      {/* Skills Alignment Matrix */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold text-[11px] uppercase tracking-wider">
                            Skills Match:
                          </span>
                          <span className="text-[11px]">
                            {candidateSkills.filter((s) =>
                              requiredSkills.some((r) => r.toLowerCase() === s.toLowerCase())
                            ).length}{" "}
                            of {requiredSkills.length} required skills matched
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {requiredSkills.map((reqSkill) => {
                            const hasMatch = candidateSkills.some(
                              (s) => s.toLowerCase() === reqSkill.toLowerCase()
                            );
                            return (
                              <span
                                key={reqSkill}
                                className={cn(
                                  "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium border",
                                  hasMatch
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : "bg-muted/50 text-muted-foreground border-border/40"
                                )}
                              >
                                {hasMatch ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                                )}
                                {reqSkill}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bio & Social Links */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          {app.user.portfolioUrl && (
                            <a
                              href={app.user.portfolioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              Portfolio
                            </a>
                          )}
                          {app.user.linkedinUrl && (
                            <a
                              href={app.user.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              LinkedIn
                            </a>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap ml-auto">
                          {/* Chat with Applicant */}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isMessaging}
                            onClick={() => handleDirectChat(app.user.id, app.project.id)}
                            className="text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          >
                            {isMessaging ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5" />
                            )}
                            Chat in WhatsApp
                          </Button>

                          {/* Decision Buttons (If Pending) */}
                          {app.status === "PENDING" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isActing}
                                onClick={() => handleDecision(app.id, "REJECTED")}
                                className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                {isActing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <X className="w-3.5 h-3.5 mr-1" />
                                )}
                                Reject
                              </Button>

                              <Button
                                size="sm"
                                disabled={isActing}
                                onClick={() => handleDecision(app.id, "ACCEPTED")}
                                className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                              >
                                {isActing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Accept Teammate
                              </Button>
                            </>
                          )}

                          {app.status === "ACCEPTED" && (
                            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Teammate Accepted
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SENT APPLICATIONS (APPLICATIONS I SUBMITTED)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "sent" && (
        <div className="space-y-4">
          {sentApps.length === 0 ? (
            <EmptyState
              icon={<Send />}
              title="No submitted applications"
              description="You haven't submitted any applications yet. Explore open project roles and apply to start collaborating!"
              actionLabel="Discover Roles"
              actionHref="/discover"
            />
          ) : (
            <div className="space-y-3">
              {sentApps.map((app) => {
                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = cfg.icon;
                const isActing = actingOn.has(app.id);

                return (
                  <Card
                    key={app.id}
                    className="bg-card/70 backdrop-blur-sm border-border/60 hover:shadow-md transition-all"
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={app.project.owner.image || undefined}
                          alt={app.project.owner.name || "Owner"}
                          size="sm"
                          className="flex-shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/projects/${app.project.id}`}
                            className="font-semibold text-sm hover:text-primary transition-colors truncate block"
                          >
                            {app.project.title}
                          </Link>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Briefcase className="w-3 h-3 flex-shrink-0" />
                            <span>{app.role.title}</span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>{app.project.projectType}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={cn("text-xs px-2.5 py-1 border gap-1.5", cfg.className)}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </Badge>

                        {/* If accepted, allow opening direct chat with project owner */}
                        {app.status === "ACCEPTED" && app.project.owner.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDirectChat(app.project.owner.id!, app.project.id)
                            }
                            className="text-xs h-7 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Chat with Lead
                          </Button>
                        )}

                        {app.status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isActing}
                            onClick={() => handleWithdraw(app.id)}
                            className="text-xs h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            {isActing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Withdraw"
                            )}
                          </Button>
                        )}

                        <Link href={`/projects/${app.project.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                            View Project <ChevronRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
