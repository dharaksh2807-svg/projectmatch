"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Briefcase,
  FolderOpen,
  Send,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ApplicationItem {
  id: string;
  status: "PENDING" | "INVITED" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  role: {
    id: string;
    title: string;
    project: {
      id: string;
      title: string;
      projectType: string;
      duration: string;
      owner: {
        id: string;
        name: string | null;
        image: string | null;
      };
    };
  };
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending Review",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  INVITED: {
    label: "Invited!",
    icon: Mail,
    className: "bg-primary/10 text-primary border-primary/30",
  },
  ACCEPTED: {
    label: "Accepted",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  DECLINED: {
    label: "Declined",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export default function ApplicationsPage() {
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<Set<string>>(new Set());

  async function loadApplications() {
    setLoading(true);
    try {
      const res = await fetch("/api/applications?view=mine");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionStatus !== "loading") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadApplications();
    }
  }, [sessionStatus]);

  async function handleRespond(
    applicationId: string,
    decision: "ACCEPTED" | "DECLINED"
  ) {
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
            ? "You accepted the invitation! Welcome to the team 🎉"
            : "Invitation declined.",
          decision === "ACCEPTED" ? "success" : "info"
        );
        // Refresh list
        await loadApplications();
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

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card rounded-2xl border border-border/50 p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44 rounded" />
                  <Skeleton className="h-4 w-60 rounded" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pendingInvites = applications.filter((a) => a.status === "INVITED");
  const myApplications = applications.filter((a) => a.status !== "INVITED");

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/dashboard" className="hover:text-primary flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-foreground font-medium">Applications</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Applications & Invites</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your applications and respond to team invitations.
          </p>
        </div>
        <Link href="/discover">
          <Button className="brand-gradient text-white gap-2 shadow-sm">
            <Send className="w-4 h-4" />
            Browse Roles
          </Button>
        </Link>
      </div>

      {/* Pending Invites Banner */}
      {pendingInvites.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-base">
              You have {pendingInvites.length} pending {pendingInvites.length === 1 ? "invitation" : "invitations"}
            </h2>
          </div>
          <div className="space-y-3">
            {pendingInvites.map((app) => (
              <div
                key={app.id}
                className="bg-card/70 rounded-xl border border-border/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={app.role.project.owner.image}
                    alt={app.role.project.owner.name || "Owner"}
                    size="sm"
                  />
                  <div>
                    <p className="font-semibold text-sm">{app.role.project.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3 h-3" />
                      {app.role.title}
                      {" · "}
                      Invited by {app.role.project.owner.name || "Project Lead"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingOn.has(app.id)}
                    onClick={() => handleRespond(app.id, "DECLINED")}
                    className="text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    {actingOn.has(app.id) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-1" />
                    )}
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={actingOn.has(app.id)}
                    onClick={() => handleRespond(app.id, "ACCEPTED")}
                    className="text-xs h-8 brand-gradient text-white gap-1"
                  >
                    {actingOn.has(app.id) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Applications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-lg">
            My Applications
            <span className="text-muted-foreground font-normal text-sm ml-2">
              ({myApplications.length} total)
            </span>
          </h2>
        </div>

        {myApplications.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No applications yet"
            description="You haven't submitted any applications yet. Explore open project roles and apply to start collaborating!"
            actionLabel="Discover Roles"
            actionHref="/discover"
          />
        ) : (
          <div className="space-y-3">
            {myApplications.map((app) => {
              const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
              const StatusIcon = cfg.icon;
              return (
                <Card
                  key={app.id}
                  className="bg-card/70 backdrop-blur-sm border-border/60 hover:shadow-md transition-all"
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={app.role.project.owner.image}
                        alt={app.role.project.owner.name || "Owner"}
                        size="sm"
                        className="flex-shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${app.role.project.id}`}
                          className="font-semibold text-sm hover:text-primary transition-colors truncate block"
                        >
                          {app.role.project.title}
                        </Link>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Briefcase className="w-3 h-3 flex-shrink-0" />
                          <span>{app.role.title}</span>
                          <span className="text-muted-foreground/40">•</span>
                          <span>{app.role.project.projectType}</span>
                          <span className="text-muted-foreground/40">•</span>
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{app.role.project.duration}</span>
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
                      <Link href={`/projects/${app.role.project.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                          View <ChevronRight className="w-3 h-3" />
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
    </div>
  );
}
