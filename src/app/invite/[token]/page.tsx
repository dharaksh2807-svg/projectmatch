"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { formatDistanceToNow } from "date-fns";
import {
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Loader2,
  LogIn,
  Check,
  Tag,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { ModeToggle } from "@/components/mode-toggle";

interface RoleData {
  id: string;
  title: string;
  description: string | null;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  isOpen: boolean;
}

interface ProjectData {
  id: string;
  title: string;
  description: string;
  projectType: string;
  duration: string;
  techStack: string[];
  owner: {
    id: string;
    name: string | null;
    image: string | null;
    bio: string | null;
    reputationScore: number;
  };
  hackathon?: {
    id: string;
    name: string;
    minTeamSize: number | null;
    maxTeamSize: number | null;
  } | null;
  currentTeamSize: number;
  maxTeamSize: number | null;
  availableCapacity: number | null;
  availableRoles: RoleData[];
}

interface InvitationInspectResult {
  found: boolean;
  isValid: boolean;
  status:
    | "ACTIVE"
    | "EXPIRED"
    | "REVOKED"
    | "EXHAUSTED"
    | "ROLE_UNAVAILABLE"
    | "TEAM_FULL"
    | "PROJECT_UNAVAILABLE"
    | "OWNER_UNAUTHORIZED";
  error?: string;
  invitation?: {
    id: string;
    expiresAt: string;
    maxUses: number;
    usesCount: number;
    remainingUses: number;
    roleSpecified: boolean;
    role: RoleData | null;
  };
  project?: ProjectData;
  currentUser?: {
    isOwner: boolean;
    isMember: boolean;
  } | null;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InvitationInspectResult | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        if (!res.ok && res.status === 404) {
          setData({ found: false, isValid: false, status: "REVOKED", error: "Invitation not found" });
          return;
        }
        const json = await res.json();
        setData(json);

        // If a specific role is specified, preselect it
        if (json.invitation?.role?.id) {
          setSelectedRoleId(json.invitation.role.id);
        } else if (json.project?.availableRoles?.length > 0) {
          setSelectedRoleId(json.project.availableRoles[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch invitation details:", err);
        setData({ found: false, isValid: false, status: "REVOKED", error: "Failed to connect" });
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadInvite();
    }
  }, [token, sessionStatus]);

  const handleAccept = async () => {
    if (sessionStatus !== "authenticated" || !session?.user?.id) {
      const callback = `/invite/${token}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callback)}`);
      return;
    }

    const roleToJoin = data?.invitation?.role?.id || selectedRoleId;
    if (!roleToJoin) {
      toast("Please select an available role to join.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: roleToJoin,
          message: message.trim() || undefined,
        }),
      });

      const resJson = await res.json();

      if (!res.ok) {
        toast(resJson.error || "Failed to join team", "error");
        setSubmitting(false);
        return;
      }

      setAcceptedSuccess(true);
      toast(resJson.message || "Welcome to the team!", "success");
    } catch (err) {
      console.error("Failed to accept invitation:", err);
      toast("An error occurred while joining the team.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Verifying secure invitation...
          </p>
        </div>
      </div>
    );
  }

  // Header Bar
  const renderNavbar = () => (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground hover:opacity-90 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ProjectMatch</span>
        </Link>
        <div className="flex items-center gap-3">
          <ModeToggle />
          {session?.user ? (
            <div className="flex items-center gap-2">
              <Avatar
                src={session.user.image}
                alt={session.user.name || "You"}
                size="sm"
              />
              <span className="text-xs font-medium text-foreground hidden sm:inline">
                {session.user.name}
              </span>
            </div>
          ) : (
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
            >
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );

  // Success State after joining
  if (acceptedSuccess && data?.project) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {renderNavbar()}
        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-6 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <Badge variant="outline" className="mb-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            Invitation Accepted
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">You are on the team! 🎉</h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-md">
            You have successfully joined <strong className="text-foreground">{data.project.title}</strong>. Your membership is recorded and the project lead has been notified.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href={`/projects/${data.project.id}`} className="w-full sm:w-auto">
              <Button className="w-full gap-2 brand-gradient text-white">
                Go to Project Page <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                View Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Not Found / Invalid link state
  if (!data || !data.found || !data.project) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {renderNavbar()}
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Invalid or Missing Invitation</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This invitation link is not recognized or may have expired. Please verify the URL with the project owner who invited you.
          </p>
          <Link href="/discover">
            <Button variant="outline">Explore Open Projects</Button>
          </Link>
        </main>
      </div>
    );
  }

  const { project, invitation, currentUser, isValid, status } = data;
  const activeRole = invitation?.role || project.availableRoles.find((r) => r.id === selectedRoleId) || null;

  // Determine expiration string
  const expirationText = invitation?.expiresAt
    ? formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })
    : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {renderNavbar()}

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
        {/* Top notification for link status if not active */}
        {!isValid && (
          <div className="mb-6 p-4 rounded-xl border flex items-start gap-3 bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <div className="font-semibold">
                {status === "REVOKED" && "This invitation link was revoked by the project owner."}
                {status === "EXPIRED" && "This invitation link has expired."}
                {status === "EXHAUSTED" && "This invitation link has reached its maximum uses."}
                {status === "ROLE_UNAVAILABLE" && "The role specified in this invitation is no longer open."}
                {status === "TEAM_FULL" && "This team has already reached its maximum capacity."}
                {status === "OWNER_UNAUTHORIZED" && "The project creator is no longer authorized to manage this team."}
                {status === "PROJECT_UNAVAILABLE" && "This project is currently not accepting new members."}
              </div>
              <p className="text-xs opacity-90 mt-1">
                You can still review the project details below or contact the project lead for an updated invitation.
              </p>
            </div>
          </div>
        )}

        {/* Existing membership notification */}
        {currentUser?.isOwner && (
          <div className="mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 bg-primary/10 border-primary/20 text-foreground">
            <div className="text-sm">
              <span className="font-semibold">You are the owner of this project.</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                This is how other candidates view your shareable team invitation link.
              </p>
            </div>
            <Link href={`/projects/${project.id}`}>
              <Button size="sm" variant="outline">
                Project Dashboard
              </Button>
            </Link>
          </div>
        )}

        {currentUser?.isMember && !currentUser.isOwner && (
          <div className="mb-6 p-4 rounded-xl border flex items-center justify-between gap-3 bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <div className="text-sm">
              <span className="font-semibold">You are already an accepted member of this team!</span>
              <p className="text-xs opacity-80 mt-0.5">
                You already joined this project and cannot accept another invitation.
              </p>
            </div>
            <Link href={`/projects/${project.id}`}>
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                View Team
              </Button>
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_340px] gap-8">
          {/* Left Column: Project and Role details */}
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {project.projectType}
                </Badge>
                {project.hackathon && (
                  <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                    <Trophy className="w-3 h-3" /> {project.hackathon.name}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {project.duration}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {project.title}
              </h1>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground mt-4 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.description) }}
              />
            </div>

            {/* Tech Stack */}
            {project.techStack?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Technologies & Tools
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {project.techStack.map((tech) => (
                    <Badge key={tech} variant="secondary" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Target Role Section */}
            <div className="pt-2 border-t border-border">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {invitation?.roleSpecified ? "Invited Position" : "Select an Open Position"}
              </h2>

              {invitation?.roleSpecified && invitation.role ? (
                <Card className="border-primary/30 bg-primary/5 shadow-xs">
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{invitation.role.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {invitation.role.requiredExperienceLevel} • {invitation.role.timeCommitment}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10">
                        {invitation.role.headcount - invitation.role.filledCount} spot remaining
                      </Badge>
                    </div>

                    {invitation.role.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {invitation.role.description}
                      </p>
                    )}

                    {invitation.role.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {invitation.role.requiredSkills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-[10px]">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    This is an open team invitation. Choose the role you would like to join as:
                  </p>
                  {project.availableRoles.length > 0 ? (
                    <div className="space-y-2">
                      {project.availableRoles.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => setSelectedRoleId(r.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                            selectedRoleId === r.id
                              ? "border-primary bg-primary/10 shadow-xs"
                              : "border-border hover:border-border/80 bg-card/60"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                              {r.title}
                              {selectedRoleId === r.id && (
                                <span className="text-[10px] font-bold text-primary bg-primary/20 px-1.5 py-0.2 rounded-full">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {r.requiredExperienceLevel} • {r.timeCommitment}
                            </p>
                            {r.requiredSkills.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {r.requiredSkills.map((s) => (
                                  <span
                                    key={s}
                                    className="text-[10px] bg-secondary/80 text-secondary-foreground px-1.5 py-0.5 rounded"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {r.headcount - r.filledCount} spot left
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-border text-center text-xs text-muted-foreground">
                      No open roles remaining on this project.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Project Lead & Action Card */}
          <div className="space-y-6">
            {/* Project Lead */}
            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Project Lead
                </h3>
                <div className="flex items-center gap-3">
                  <Avatar
                    src={project.owner.image}
                    alt={project.owner.name || "Owner"}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{project.owner.name}</div>
                    <ReputationBadge score={project.owner.reputationScore} size="sm" />
                  </div>
                </div>
                {project.owner.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {project.owner.bio}
                  </p>
                )}
                <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Team Size:</span>
                    <span className="font-medium text-foreground">
                      {project.currentTeamSize}
                      {project.maxTeamSize ? ` / ${project.maxTeamSize} max` : " members"}
                    </span>
                  </div>
                  {invitation && (
                    <div className="flex items-center justify-between">
                      <span>Invite Expiration:</span>
                      <span className="font-medium text-foreground">
                        {isValid ? `Expires ${expirationText}` : "Expired"}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Card: Join Team */}
            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-base font-bold text-foreground">
                  Accept Invitation
                </h3>

                {isValid && !currentUser?.isMember && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                        Introductory note (optional)
                      </label>
                      <Textarea
                        placeholder="Say hello to the team or note your background..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="text-xs resize-none"
                        rows={3}
                        maxLength={500}
                      />
                    </div>

                    {sessionStatus === "authenticated" ? (
                      <Button
                        onClick={handleAccept}
                        disabled={submitting || !activeRole}
                        className="w-full brand-gradient text-white font-semibold gap-2 shadow-xs cursor-pointer"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Joining Team...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" /> Join as {activeRole?.title || "Teammate"}
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Link
                          href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                          className="block"
                        >
                          <Button className="w-full brand-gradient text-white font-semibold gap-2 shadow-xs cursor-pointer">
                            <LogIn className="w-4 h-4" /> Sign In to Join Team
                          </Button>
                        </Link>
                        <p className="text-[11px] text-muted-foreground text-center">
                          You will return to this invitation immediately after authentication.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!isValid && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      This invitation cannot be accepted because it is no longer active.
                    </p>
                    <Link href="/discover" className="block">
                      <Button variant="outline" className="w-full text-xs">
                        Browse Other Projects
                      </Button>
                    </Link>
                  </div>
                )}

                {currentUser?.isMember && (
                  <div className="space-y-2">
                    <Link href={`/projects/${project.id}`} className="block">
                      <Button className="w-full text-xs gap-1.5">
                        Open Project Workspace <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
