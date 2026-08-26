import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Users,
  Sparkles,
  CheckCircle2,
  Circle,
  ExternalLink,
} from "lucide-react";
import type { Metadata } from "next";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { RateTeammatesSection, MarkCompleteButton } from "@/components/ratings/rate-teammates-section";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { title: true } });
  return { title: project?.title || "Project" };
}

const PROJECT_TYPE_COLORS: Record<string, string> = {
  Hackathon: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Startup: "bg-primary/15 text-primary border-primary/20",
  Research: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Open Source": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Side Project": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  Competition: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          reputationScore: true,
          portfolioLinks: true,
          skills: true,
          experienceLevel: true,
        },
      },
      roles: {
        include: {
          applications: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  skills: true,
                  experienceLevel: true,
                  reputationScore: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      team: {
        include: {
          members: {
            select: {
              id: true,
              name: true,
              image: true,
              skills: true,
              experienceLevel: true,
              reputationScore: true,
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  // Force-serialize to strip Prisma Date objects / prototypes (Error #441)
  const safeProject = JSON.parse(JSON.stringify(project));

  const isOwner = safeProject.owner.email === session.user.email;
  const colorClass =
    PROJECT_TYPE_COLORS[safeProject.projectType] ||
    "bg-secondary text-secondary-foreground border-border";

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Back */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {isOwner ? "My Projects" : "Browse"}
      </Link>

      {/* Header */}
      <div className="glass-card rounded-2xl border border-border/50 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl brand-gradient flex items-center justify-center flex-shrink-0 glow">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold tracking-tight">{safeProject.title}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${colorClass}`}>
                {safeProject.projectType}
              </span>
              {/* Status badge */}
              {safeProject.status === "COMPLETED" ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full border font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  ✓ Completed
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full border font-medium bg-sky-500/10 text-sky-400 border-sky-500/20">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {safeProject.duration}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {safeProject.roles.length} role{safeProject.roles.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {safeProject.description}
            </p>
            {/* Owner actions */}
            {isOwner && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MarkCompleteButton
                  projectId={safeProject.id}
                  currentStatus={safeProject.status}
                  onCompleted={() => {}}
                />
              </div>
            )}
            {/* Rate teammates prompt (for completed projects) */}
            {safeProject.status === "COMPLETED" && (
              <div className="mt-3">
                <RateTeammatesSection
                  projectId={safeProject.id}
                  projectTitle={safeProject.title}
                />
              </div>
            )}
          </div>
        </div>

        {/* Owner info */}
        <div className="mt-5 pt-5 border-t border-border/50 flex items-center gap-3">
          {safeProject.owner.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeProject.owner.image}
              alt={safeProject.owner.name || "Owner"}
              className="w-9 h-9 rounded-full ring-2 ring-border"
            />
          ) : (
            <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold">
              {(safeProject.owner.name || "?")[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium">{safeProject.owner.name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ReputationBadge score={safeProject.owner.reputationScore} showLabel />
              {isOwner && <span className="ml-1 text-primary">(You)</span>}
            </div>
          </div>
          {safeProject.owner.portfolioLinks.length > 0 && (
            <div className="ml-auto flex gap-2">
              {safeProject.owner.portfolioLinks.slice(0, 3).map((link: string) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg border border-border hover:border-primary/30 hover:bg-accent transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Roles */}
      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold">Open Roles</h2>
        {safeProject.roles.map((role: Record<string, unknown> & { id: string; title: string; filledCount: number; headcount: number; requiredExperienceLevel: string; timeCommitment: string; requiredSkills: string[]; applications: Array<{ id: string; status: string; user: { id: string; name: string | null; image: string | null; skills: string[]; experienceLevel: string | null; reputationScore: number } }> }) => {
          const isFilled = role.filledCount >= role.headcount;
          const pendingApps = role.applications.filter((a) => a.status === "PENDING");

          return (
            <div
              key={role.id}
              className="glass-card rounded-2xl border border-border/50 p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    {isFilled ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">{role.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground ml-7">
                    <span>{role.requiredExperienceLevel} level</span>
                    <span>•</span>
                    <span>{role.timeCommitment}</span>
                    <span>•</span>
                    <span>
                      {role.filledCount}/{role.headcount} filled
                    </span>
                  </div>
                </div>
                {isFilled ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium flex-shrink-0">
                    Filled
                  </span>
                ) : isOwner && pendingApps.length > 0 ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium flex-shrink-0">
                    {pendingApps.length} pending
                  </span>
                ) : null}
              </div>

              {/* Required Skills */}
              <div className="flex flex-wrap items-center justify-between gap-3 ml-7">
                <div className="flex flex-wrap gap-1.5">
                  {role.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs px-2.5 py-0.5 rounded-lg bg-secondary text-secondary-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {isOwner && !isFilled && (
                  <Link href={`/projects/${safeProject.id}/roles/${role.id}`}>
                    <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl brand-gradient text-white hover:opacity-90 shadow-sm transition-all">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Find Matching Candidates</span>
                    </button>
                  </Link>
                )}
              </div>

              {/* Applications for owner */}
              {isOwner && role.applications.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2 ml-7">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Applicants
                  </p>
                  {role.applications.slice(0, 5).map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors"
                    >
                      {app.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={app.user.image}
                          alt={app.user.name || ""}
                          className="w-7 h-7 rounded-full"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center text-white text-xs font-bold">
                          {(app.user.name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{app.user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {app.user.skills.slice(0, 4).join(", ")}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          app.status === "ACCEPTED"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : app.status === "DECLINED"
                            ? "bg-destructive/15 text-destructive"
                            : app.status === "INVITED"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {app.status.charAt(0) + app.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Apply button (non-owner) */}
              {!isOwner && !isFilled && (
                <div className="mt-4 ml-7">
                  <button className="px-4 py-2 rounded-xl brand-gradient text-white text-sm font-medium hover:opacity-90 transition-all glow-sm">
                    Apply to this Role
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Team Members (if team exists) */}
      {safeProject.team && safeProject.team.members.length > 0 && (
        <div className="glass-card rounded-2xl border border-border/50 p-5">
          <h2 className="font-semibold mb-4">Team</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {safeProject.team.members.map((member: { id: string; name: string | null; image: string | null; skills: string[]; experienceLevel: string | null; reputationScore: number }) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors"
              >
                {member.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.image}
                    alt={member.name || ""}
                    className="w-9 h-9 rounded-full ring-2 ring-border"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold">
                    {(member.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{member.experienceLevel}</p>
                    <ReputationBadge score={member.reputationScore} size="xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
