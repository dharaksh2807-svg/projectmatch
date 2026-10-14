"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase,
  Users,
  Sparkles,
  Plus,
  ArrowRight,
  MessageSquare,
  Trophy,
  Swords,
  ExternalLink,
  Bell,
  Zap,
  TrendingUp,
  FolderGit2,
  Calendar,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  GithubIcon,
  LinkedinIcon,
  LeetCodeIcon,
  CodeforcesIcon,
  HackerRankIcon,
  KaggleIcon,
  GoogleDriveIcon,
} from "@/components/shared/social-icons";
import { cn } from "@/lib/utils";

export interface SerializedUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  bio: string | null;
  skills: string[];
  experienceLevel: string | null;
  availability: string | null;
  timezone: string | null;
  reputationScore: number;
  portfolioUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  leetcodeUrl: string | null;
  codeforcesUrl: string | null;
  hackerrankUrl: string | null;
  kaggleUrl: string | null;
  resumeUrl: string | null;
}

export interface SerializedRole {
  id: string;
  title: string;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  isOpen: boolean;
}

export interface SerializedProject {
  id: string;
  title: string;
  description: string;
  projectType: string;
  duration: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  roles: SerializedRole[];
  applications: { id: string; status: string }[];
  hackathon?: { id: string; name: string } | null;
}

export interface SerializedSentApplication {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  message: string | null;
  createdAt: string;
  role: {
    id: string;
    title: string;
    requiredSkills: string[];
    timeCommitment: string;
    isOpen: boolean;
  };
  project: {
    id: string;
    title: string;
    projectType: string;
    duration: string;
    owner: {
      id: string;
      name: string | null;
      image: string | null;
      reputationScore: number;
    };
  };
}

export interface SerializedInboundApplication {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    skills: string[];
    experienceLevel: string | null;
    reputationScore: number;
    resumeUrl: string | null;
    githubUrl: string | null;
  };
  role: {
    id: string;
    title: string;
  };
  project: {
    id: string;
    title: string;
  };
}

export interface SerializedRecommendedRole {
  id: string;
  title: string;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  matchPercent: number;
  matchingSkillsCount: number;
  matchingSkills: string[];
  project: {
    id: string;
    title: string;
    projectType: string;
    duration: string;
    owner: {
      id: string;
      name: string | null;
      image: string | null;
      reputationScore: number;
    };
  };
}

export interface SerializedHackathon {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  websiteUrl: string | null;
  devpostUrl: string | null;
  _count: {
    projects: number;
  };
}

export interface SerializedConversation {
  id: string;
  updatedAt: string;
  otherUser: {
    id: string;
    name: string | null;
    image: string | null;
  };
  project?: {
    id: string;
    title: string;
  } | null;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    isRead: boolean;
  } | null;
}

export interface SerializedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  ownedProjectsCount: number;
  activeRolesCount: number;
  applicationsSentCount: number;
  acceptedApplicationsCount: number;
  pendingApplicationsCount: number;
  inboundPendingCount: number;
  reputationScore: number;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  activeHackathonsCount: number;
  promptBattlesCount: number;
  profileCompleteness: number;
  missingProfileFields: string[];
}

interface DashboardViewProps {
  user: SerializedUser;
  stats: DashboardStats;
  ownedProjects: SerializedProject[];
  sentApplications: SerializedSentApplication[];
  inboundPendingApps: SerializedInboundApplication[];
  recommendedRoles: SerializedRecommendedRole[];
  activeHackathons: SerializedHackathon[];
  recentConversations: SerializedConversation[];
  recentNotifications: SerializedNotification[];
}

export function DashboardView({
  user,
  stats,
  ownedProjects,
  sentApplications,
  inboundPendingApps,
  recommendedRoles,
  activeHackathons,
  recentConversations,
  recentNotifications,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "applications" | "recommendations">("overview");

  const displayName = user.name?.split(" ")[0] || "Builder";

  return (
    <div className="p-3.5 sm:p-5 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in min-w-0 overflow-x-hidden">
      {/* ─────────────────────────────────────────────────────────────
          1. WELCOME HERO & ACTION BAR
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row items-start gap-3.5 sm:gap-4">
          <Avatar
            src={user.image}
            alt={user.name || "User"}
            fallback={(user.name || "U")[0]}
            size="xl"
            className="ring-2 ring-primary/20 shadow-md shrink-0"
          />
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground break-words">
                Welcome back, {displayName} 👋
              </h1>
              <ReputationBadge score={stats.reputationScore} showLabel size="md" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Track your projects, team applications, active hackathons, and AI-matched collaboration opportunities.
            </p>
            {/* Quick Profile completeness meter */}
            <div className="flex items-center gap-2.5 sm:gap-3 pt-1 text-xs flex-wrap">
              <div className="w-24 sm:w-28 h-2 rounded-full bg-secondary overflow-hidden border border-border/40 shrink-0">
                <div
                  className="h-full brand-gradient transition-all duration-500 rounded-full"
                  style={{ width: `${stats.profileCompleteness}%` }}
                />
              </div>
              <span className="font-medium text-foreground/90 whitespace-nowrap">
                {stats.profileCompleteness}% profile complete
              </span>
              {stats.profileCompleteness < 100 && (
                <Link
                  href="/profile"
                  className="text-primary hover:underline font-semibold flex items-center gap-0.5 whitespace-nowrap"
                >
                  Boost matches <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Primary CTA Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto self-stretch sm:self-start md:self-center">
          <Link href="/projects/new" className="flex-1 sm:flex-none">
            <Button className="w-full sm:w-auto brand-gradient text-white gap-2 font-medium shadow-sm hover:opacity-95 transition-all text-xs sm:text-sm">
              <Plus className="w-4 h-4" /> Post a Project
            </Button>
          </Link>
          <Link href="/discover" className="flex-1 sm:flex-none">
            <Button variant="outline" className="w-full sm:w-auto gap-2 border-primary/30 text-primary hover:bg-primary/10 text-xs sm:text-sm">
              <Sparkles className="w-4 h-4" /> Find Roles
            </Button>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. INBOUND APPLICANTS ALERT (If Project Lead has Pending Apps)
          ───────────────────────────────────────────────────────────── */}
      {stats.inboundPendingCount > 0 && (
        <div className="rounded-2xl p-4 md:p-5 border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/5 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Action Required: {stats.inboundPendingCount} applicant{stats.inboundPendingCount !== 1 ? "s" : ""} waiting for your review
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300/80">
                Candidates have applied to join your project roles. Review their skills, GitHub, and resumes now.
              </p>
            </div>
          </div>
          <Link href="/applications" className="flex-shrink-0 w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white gap-1.5 font-medium shadow-sm">
              <UserCheck className="w-3.5 h-3.5" /> Review Applications
            </Button>
          </Link>
        </div>
      )}

      {/* Inbound applicants preview cards */}
      {inboundPendingApps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-500" /> Pending Inbound Candidates
            </h3>
            <Link href="/applications" className="text-xs text-primary hover:underline">
              View all ({inboundPendingApps.length}) →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inboundPendingApps.slice(0, 3).map((app) => (
              <div
                key={app.id}
                className="glass-card rounded-xl p-3 border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    src={app.user.image}
                    alt={app.user.name || "Applicant"}
                    fallback={(app.user.name || "A")[0]}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {app.user.name || "Builder"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      For <span className="text-primary font-medium">{app.role.title}</span> in {app.project.title}
                    </p>
                  </div>
                </div>
                <Link href="/applications" className="shrink-0">
                  <Button size="xs" className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
                    Review
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. REAL STATS GRID (6 Key Data Points)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
        {/* Projects Owned */}
        <Link
          href="#my-projects"
          onClick={() => setActiveTab("projects")}
          className="glass-card rounded-2xl p-3 sm:p-4 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all group cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5 sm:mb-2">
            <span className="text-xs font-medium truncate">Projects</span>
            <FolderGit2 className="w-4 h-4 text-primary group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.ownedProjectsCount}</div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
            {stats.activeRolesCount} open role{stats.activeRolesCount !== 1 ? "s" : ""}
          </p>
        </Link>

        {/* Applications Sent */}
        <Link
          href="/applications"
          className="glass-card rounded-2xl p-3 sm:p-4 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all group cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5 sm:mb-2">
            <span className="text-xs font-medium truncate">Applied</span>
            <Briefcase className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.applicationsSentCount}</div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
            {stats.acceptedApplicationsCount} accepted • {stats.pendingApplicationsCount} pending
          </p>
        </Link>

        {/* Inbound Applicants */}
        <Link
          href="/applications"
          className="glass-card rounded-2xl p-3 sm:p-4 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all group cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5 sm:mb-2">
            <span className="text-xs font-medium truncate">Applicants</span>
            <Users className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.inboundPendingCount}</div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
            {stats.inboundPendingCount > 0 ? "Pending review" : "Up to date"}
          </p>
        </Link>

        {/* Reputation Score */}
        <Link
          href="/profile"
          className="glass-card rounded-2xl p-3 sm:p-4 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all group cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5 sm:mb-2">
            <span className="text-xs font-medium truncate">Reputation</span>
            <TrendingUp className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.reputationScore.toFixed(0)}<span className="text-xs font-normal text-muted-foreground">/100</span></div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Peer feedback score</p>
        </Link>

        {/* Team Messages */}
        <Link
          href="/messages"
          className="glass-card rounded-2xl p-3 sm:p-4 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all group cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5 sm:mb-2">
            <span className="text-xs font-medium truncate">Messages</span>
            <MessageSquare className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.unreadMessagesCount}</div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
            {stats.unreadMessagesCount > 0 ? "Unread chats" : "All chats read"}
          </p>
        </Link>

        {/* Hackathons Active */}
        <Link
          href="/hackathons"
          className="glass-card rounded-2xl p-3 sm:p-4 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all group cursor-pointer min-w-0"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5 sm:mb-2">
            <span className="text-xs font-medium truncate">Hackathons</span>
            <Trophy className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.activeHackathonsCount}</div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Active events</p>
        </Link>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. QUICK SHORTCUTS ROW
          ───────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Quick Launchpads
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {[
            {
              href: "/discover",
              title: "Discover Roles",
              desc: "AI-matched projects",
              icon: Sparkles,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              href: "/projects/new",
              title: "Post Project",
              desc: "Recruit collaborators",
              icon: Plus,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
            },
            {
              href: "/hackathons",
              title: "Hackathons",
              desc: "Find events & teams",
              icon: Trophy,
              color: "text-amber-500",
              bg: "bg-amber-500/10",
            },
            {
              href: "/applications",
              title: "Applications",
              desc: "Manage team requests",
              icon: Briefcase,
              color: "text-sky-500",
              bg: "bg-sky-500/10",
            },
            {
              href: "/messages",
              title: "Direct Messages",
              desc: "Chat with teammates",
              icon: MessageSquare,
              color: "text-purple-500",
              bg: "bg-purple-500/10",
            },
            {
              href: "/prompt-battles",
              title: "Prompt Arena",
              desc: "Battle AI models",
              icon: Swords,
              color: "text-rose-500",
              bg: "bg-rose-500/10",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="glass-card rounded-xl p-3 border border-border/50 hover:border-primary/40 hover:-translate-y-0.5 transition-all group flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center gap-2 mb-1.5 min-w-0">
                <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", item.bg, item.color)}>
                  <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                  {item.title}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{item.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. INTERACTIVE VIEW TABS (Scrollable on Mobile)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-border/50 pb-2 overflow-x-auto no-scrollbar whitespace-nowrap -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        {(
          [
            { id: "overview", label: "Dashboard Overview" },
            { id: "projects", label: `My Projects (${ownedProjects.length})` },
            { id: "applications", label: `Sent Applications (${sentApplications.length})` },
            { id: "recommendations", label: `AI Matches (${recommendedRoles.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. MAIN CONTENT LAYOUT (2 Cols Left, 1 Col Right)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        {/* ── LEFT 2 COLUMNS ── */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8 min-w-0">
          {/* TAB: OVERVIEW or PROJECTS: My Projects Section */}
          {(activeTab === "overview" || activeTab === "projects") && (
            <div id="my-projects" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5 text-primary" /> My Projects
                  </h2>
                  <p className="text-xs text-muted-foreground">Projects created by you to recruit teammates</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/projects/new">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Plus className="w-3.5 h-3.5" /> Create
                    </Button>
                  </Link>
                </div>
              </div>

              {ownedProjects.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {ownedProjects.slice(0, activeTab === "projects" ? undefined : 4).map((project) => {
                    const totalRoles = project.roles.length;
                    const openRoles = project.roles.filter((r) => r.isOpen).length;
                    const pendingApps = project.applications.filter((a) => a.status === "PENDING").length;

                    return (
                      <Card key={project.id} className="glass-card border-border/60 hover:border-primary/40 transition-all flex flex-col justify-between">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant={project.isPublished ? "secondary" : "outline"} className="text-[10px]">
                              {project.isPublished ? project.projectType : "Draft"}
                            </Badge>
                            {pendingApps > 0 && (
                              <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] animate-pulse">
                                {pendingApps} pending app{pendingApps !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base font-bold mt-1 line-clamp-1">
                            {project.title}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-2 mt-0.5">
                            {project.description.replace(/<[^>]*>/g, "")}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4 pt-2 space-y-3">
                          <div className="flex flex-wrap gap-1">
                            {project.roles.slice(0, 3).map((r) => (
                              <span key={r.id} className="text-[10px] bg-secondary/80 text-foreground px-2 py-0.5 rounded-md border border-border/40">
                                {r.title}
                              </span>
                            ))}
                            {project.roles.length > 3 && (
                              <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                                +{project.roles.length - 3} more
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                            <span>{openRoles}/{totalRoles} roles open</span>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/projects/${project.id}`}
                                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                              >
                                View <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<FolderGit2 className="w-6 h-6" />}
                  title="No projects posted yet"
                  description="Post a project or hackathon idea to start finding developers, designers, and teammates."
                  actionLabel="Create Your First Project"
                  actionHref="/projects/new"
                />
              )}
            </div>
          )}

          {/* TAB: OVERVIEW or APPLICATIONS: Sent Applications Section */}
          {(activeTab === "overview" || activeTab === "applications") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-emerald-500" /> Applications Tracker
                  </h2>
                  <p className="text-xs text-muted-foreground">Status of roles you have applied for</p>
                </div>
                <Link href="/applications" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Manage all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {sentApplications.length > 0 ? (
                <div className="space-y-3">
                  {sentApplications.slice(0, activeTab === "applications" ? undefined : 4).map((app) => (
                    <div
                      key={app.id}
                      className="glass-card rounded-xl p-4 border border-border/60 hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={app.project.owner.image}
                          alt={app.project.owner.name || "Owner"}
                          fallback={(app.project.owner.name || "P")[0]}
                          size="md"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                              {app.role.title}
                            </span>
                            <span className="text-xs text-muted-foreground">at</span>
                            <Link
                              href={`/projects/${app.project.id}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              {app.project.title}
                            </Link>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Lead: {app.project.owner.name || "Project Lead"} • Applied {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span
                          className={cn(
                            "text-xs px-2.5 py-0.5 rounded-full font-semibold border",
                            app.status === "ACCEPTED"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : app.status === "PENDING"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : app.status === "REJECTED"
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                          )}
                        >
                          {app.status === "PENDING"
                            ? "Under Review"
                            : app.status === "ACCEPTED"
                            ? "Accepted 🎉"
                            : app.status === "REJECTED"
                            ? "Declined"
                            : "Withdrawn"}
                        </span>
                        <Link href={`/projects/${app.project.id}`}>
                          <Button size="xs" variant="ghost">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Briefcase className="w-6 h-6" />}
                  title="No applications yet"
                  description="You haven't applied to any roles. Explore open positions matched to your tech stack."
                  actionLabel="Explore Open Roles"
                  actionHref="/discover"
                />
              )}
            </div>
          )}

          {/* TAB: OVERVIEW or RECOMMENDATIONS: AI Recommended Roles */}
          {(activeTab === "overview" || activeTab === "recommendations") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> Recommended For You
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Matches calculated based on your skills: {user.skills.length > 0 ? user.skills.slice(0, 4).join(", ") : "No skills added yet"}
                  </p>
                </div>
                <Link href="/discover" className="text-xs text-primary hover:underline flex items-center gap-1">
                  Browse all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {recommendedRoles.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {recommendedRoles.slice(0, activeTab === "recommendations" ? undefined : 4).map((role) => (
                    <Card key={role.id} className="glass-card border-border/60 hover:border-primary/40 transition-all flex flex-col justify-between">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                            {role.project.projectType}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full border",
                              role.matchPercent >= 75
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : role.matchPercent >= 50
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-secondary text-muted-foreground border-border/40"
                            )}
                          >
                            {role.matchPercent}% Match
                          </span>
                        </div>
                        <CardTitle className="text-base font-bold mt-1 line-clamp-1">
                          {role.title}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-1">
                          in <span className="text-foreground font-medium">{role.project.title}</span>
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-4 pt-2 space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {role.requiredSkills.slice(0, 4).map((s) => {
                            const isMatch = role.matchingSkills?.some((ms) => ms.toLowerCase() === s.toLowerCase());
                            return (
                              <span
                                key={s}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-md border",
                                  isMatch
                                    ? "bg-primary/15 text-primary border-primary/30 font-semibold"
                                    : "bg-secondary text-muted-foreground border-border/40"
                                )}
                              >
                                {s}
                              </span>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                          <span className="text-muted-foreground">{role.timeCommitment}</span>
                          <Link href={`/projects/${role.project.id}`}>
                            <Button size="xs" className="brand-gradient text-white">
                              View Role
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Sparkles className="w-6 h-6" />}
                  title="No role recommendations yet"
                  description={
                    user.skills.length === 0
                      ? "Add your skills in your profile to enable personalized role matching."
                      : "Check back soon as new projects and hackathons are published."
                  }
                  actionLabel={user.skills.length === 0 ? "Add Your Skills" : "Browse Discover"}
                  actionHref={user.skills.length === 0 ? "/profile" : "/discover"}
                />
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN (Collaboration, Hackathons, Profiles) ── */}
        <div className="space-y-6">
          {/* Active Hackathons */}
          <Card className="glass-card border-border/60">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" /> Featured Hackathons
                </CardTitle>
                <Link href="/hackathons" className="text-xs text-primary hover:underline">
                  All
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              {activeHackathons.length > 0 ? (
                activeHackathons.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-secondary/50 border border-border/40 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground line-clamp-1">{h.name}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {h._count.projects} team{h._count.projects !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {h.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{h.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {h.startDate ? new Date(h.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Upcoming"}
                      </span>
                      <Link href="/hackathons" className="text-primary hover:underline font-medium">
                        Find Team →
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No active hackathons at this moment.</p>
              )}
            </CardContent>
          </Card>

          {/* Connected Tech Links & Resume Status */}
          <Card className="glass-card border-border/60">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-primary" /> Tech Identity & CV
                </CardTitle>
                <Link href="/profile" className="text-xs text-primary hover:underline">
                  Edit
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2.5">
              {/* Resume / CV */}
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                <span className="flex items-center gap-2">
                  <GoogleDriveIcon className="w-4 h-4 text-primary" />
                  <span className="font-medium">Google Drive Resume</span>
                </span>
                {user.resumeUrl ? (
                  <a
                    href={user.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary underline">
                    Add link
                  </Link>
                )}
              </div>

              {/* GitHub */}
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                <span className="flex items-center gap-2">
                  <GithubIcon className="w-4 h-4 text-foreground/80" />
                  <span className="font-medium">GitHub Profile</span>
                </span>
                {user.githubUrl ? (
                  <a
                    href={user.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground/80 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Connected <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary underline">
                    Add link
                  </Link>
                )}
              </div>

              {/* LinkedIn */}
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                <span className="flex items-center gap-2">
                  <LinkedinIcon className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">LinkedIn</span>
                </span>
                {user.linkedinUrl ? (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Connected <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary underline">
                    Add link
                  </Link>
                )}
              </div>

              {/* LeetCode */}
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                <span className="flex items-center gap-2">
                  <LeetCodeIcon className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">LeetCode</span>
                </span>
                {user.leetcodeUrl ? (
                  <a
                    href={user.leetcodeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-500 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Connected <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary underline">
                    Add link
                  </Link>
                )}
              </div>

              {/* Codeforces */}
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                <span className="flex items-center gap-2">
                  <CodeforcesIcon className="w-4 h-4 text-rose-500" />
                  <span className="font-medium">Codeforces</span>
                </span>
                {user.codeforcesUrl ? (
                  <a
                    href={user.codeforcesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-rose-500 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Connected <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary underline">
                    Add link
                  </Link>
                )}
              </div>

              {/* HackerRank */}
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                <span className="flex items-center gap-2">
                  <HackerRankIcon className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium">HackerRank</span>
                </span>
                {user.hackerrankUrl ? (
                  <a
                    href={user.hackerrankUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-500 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Connected <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary underline">
                    Add link
                  </Link>
                )}
              </div>

              {/* Kaggle */}
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/40 border border-border/30">
                <span className="flex items-center gap-2">
                  <KaggleIcon className="w-4 h-4 text-cyan-500" />
                  <span className="font-medium">Kaggle</span>
                </span>
                {user.kaggleUrl ? (
                  <a
                    href={user.kaggleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-500 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Connected <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <Link href="/profile" className="text-xs text-muted-foreground hover:text-primary underline">
                    Add link
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Direct Messages */}
          <Card className="glass-card border-border/60">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-500" /> Team Chats
                </CardTitle>
                <Link href="/messages" className="text-xs text-primary hover:underline">
                  All
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {recentConversations.length > 0 ? (
                recentConversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/messages?c=${c.id}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/60 transition-colors group"
                  >
                    <Avatar
                      src={c.otherUser.image}
                      alt={c.otherUser.name || "User"}
                      fallback={(c.otherUser.name || "U")[0]}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {c.otherUser.name || "Teammate"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.lastMessage ? c.lastMessage.content : "Start conversation..."}
                      </p>
                    </div>
                    {c.lastMessage && !c.lastMessage.isRead && c.lastMessage.senderId !== user.id && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </Link>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground mb-2">No messages yet.</p>
                  <Link href="/discover">
                    <Button size="xs" variant="outline">
                      Find Teammates
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card className="glass-card border-border/60">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" /> Notifications
                </CardTitle>
                <Link href="/notifications" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2.5">
              {recentNotifications.length > 0 ? (
                recentNotifications.map((n) => (
                  <div key={n.id} className="text-xs space-y-0.5 pb-2 border-b border-border/30 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground line-clamp-1">{n.title}</span>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{n.body}</p>
                    <span className="text-[10px] text-muted-foreground/70 block">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No new notifications.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
