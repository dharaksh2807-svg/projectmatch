import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Plus,
  Sparkles,
  Users,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "My Projects" };

const PROJECT_TYPE_COLORS: Record<string, string> = {
  Hackathon: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Startup: "bg-primary/15 text-primary border-primary/20",
  Research: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Open Source": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Side Project": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  Competition: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    include: {
      roles: {
        include: {
          _count: { select: { applications: true } },
        },
      },
      team: {
        include: { members: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Projects you own and manage.
          </p>
        </div>
        <Link
          href="/projects/new"
          id="new-project-btn"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl brand-gradient text-white font-medium text-sm hover:opacity-90 transition-all glow-sm"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No projects yet"
          description="Create your first project and start finding the perfect teammates using our AI-powered matching engine."
          actionLabel="Create Your First Project"
          actionHref="/projects/new"
        />
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const openRoles = project.roles.filter((r) => r.filledCount < r.headcount);
            const totalApplications = project.roles.reduce(
              (sum, r) => sum + r._count.applications,
              0
            );
            const colorClass =
              PROJECT_TYPE_COLORS[project.projectType] ||
              "bg-secondary text-secondary-foreground border-border";

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block glass-card rounded-2xl border border-border/50 p-5 hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl brand-gradient flex items-center justify-center flex-shrink-0 glow-sm">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                          {project.title}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorClass}`}
                        >
                          {project.projectType}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {project.duration}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {openRoles.length} open role{openRoles.length !== 1 ? "s" : ""}
                  </div>
                  {totalApplications > 0 && (
                    <div className="flex items-center gap-1.5 text-primary">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {totalApplications} application{totalApplications !== 1 ? "s" : ""}
                    </div>
                  )}
                  {project.team && (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {project.team.members.length} team member{project.team.members.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
