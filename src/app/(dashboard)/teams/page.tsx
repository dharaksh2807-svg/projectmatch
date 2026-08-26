import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Users,
  Clock,
  ArrowRight,
  Shield,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { RateTeammatesSection } from "@/components/ratings/rate-teammates-section";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Teams" };

export default async function TeamsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });

  if (!currentUser) redirect("/login");

  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { members: { some: { id: currentUser.id } } },
        { project: { ownerId: currentUser.id } },
      ],
    },
    include: {
      project: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
              reputationScore: true,
            },
          },
          roles: {
            select: {
              id: true,
              title: true,
              filledCount: true,
              headcount: true,
            },
          },
        },
      },
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
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            My Teams
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Projects and teams you are actively collaborating with or leading.
          </p>
        </div>
        <Link href="/discover">
          <Button variant="outline" className="gap-2 text-xs self-start">
            <Layers className="w-4 h-4 text-primary" />
            Find More Projects
          </Button>
        </Link>
      </div>

      {/* Teams Grid or Empty State */}
      {teams.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="You're not on any team yet"
          description="Join project teams by applying to open roles on the discovery page, or create your own project to assemble a dream team."
          actionLabel="Explore Open Roles"
          actionHref="/discover"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team) => {
            const isOwner = team.project.ownerId === currentUser.id;
            const isCompleted = team.project.status === "COMPLETED";

            return (
              <div
                key={team.id}
                className="glass-card rounded-2xl border border-border/60 p-6 flex flex-col justify-between space-y-5 hover:shadow-xl hover:border-primary/40 transition-all duration-300 group"
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[11px] font-semibold uppercase tracking-wider bg-secondary/50"
                      >
                        {team.project.projectType}
                      </Badge>
                      {isCompleted ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px]"
                        >
                          ✓ Completed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-sky-500/10 text-sky-400 border-sky-500/30 text-[11px]"
                        >
                          Active
                        </Badge>
                      )}
                    </div>

                    {isOwner && (
                      <span className="text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Project Lead
                      </span>
                    )}
                  </div>

                  {/* Project Info */}
                  <div>
                    <Link href={`/projects/${team.project.id}`}>
                      <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer line-clamp-1">
                        {team.project.title}
                      </h2>
                    </Link>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                      {team.project.description}
                    </p>
                  </div>

                  {/* Project Specs */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {team.project.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Teammates Preview */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Teammates
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-secondary/40 border border-border/40 text-xs"
                        >
                          {member.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={member.image}
                              alt={member.name || "Member"}
                              className="w-5 h-5 rounded-full ring-1 ring-border"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                              {(member.name || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-foreground truncate max-w-[90px]">
                            {member.name || "Member"}
                          </span>
                          <ReputationBadge score={member.reputationScore} size="xs" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rate Teammates Section if project is completed */}
                  {isCompleted && (
                    <div className="pt-2">
                      <RateTeammatesSection
                        projectId={team.project.id}
                        projectTitle={team.project.title}
                      />
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Lead:</span>
                    <span className="text-xs font-medium text-foreground">
                      {team.project.owner.name}
                    </span>
                    <ReputationBadge score={team.project.owner.reputationScore} size="xs" />
                  </div>

                  <Link href={`/projects/${team.project.id}`}>
                    <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 group-hover:text-primary">
                      <span>View Project</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
