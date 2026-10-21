import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, FolderGit2, Sparkles, ArrowRight, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects | ProjectMatch",
  description: "Manage your posted projects or explore open projects.",
};

interface RoleItem {
  id: string;
  isOpen: boolean;
}

interface ProjectItem {
  id: string;
  title: string;
  description: string;
  projectType: string;
  duration: string;
  techStack: string[];
  ownerId: string;
  isPublished?: boolean;
  roles: RoleItem[];
  applications?: { id: string; status: string }[];
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string } | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let userId = (session.user as { id?: string }).id;
  if (!userId && session.user.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    userId = dbUser?.id;
  }
  if (!userId) redirect("/login");

  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams?.tab || "mine";

  const [myProjects, allProjects] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      include: {
        roles: true,
        applications: { select: { id: true, status: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.findMany({
      where: { isPublished: true },
      include: {
        roles: true,
        applications: { select: { id: true, status: true } },
        owner: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const projectsToDisplay = tab === "all" ? allProjects : myProjects;

  return (
    <div className="p-3.5 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in min-w-0 overflow-x-hidden font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" /> Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your recruitment listings or explore collaborative projects across the community.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/projects/new" className="w-full sm:w-auto">
            <Button className="font-semibold shadow-xs w-full sm:w-auto gap-2">
              <Plus className="w-4 h-4" /> Post a Project
            </Button>
          </Link>
          <Link href="/discover" className="w-full sm:w-auto">
            <Button variant="outline" className="gap-2 w-full sm:w-auto border-border">
              <Sparkles className="w-4 h-4 text-primary" /> Discover Roles
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto no-scrollbar whitespace-nowrap">
        <Link
          href="/projects?tab=mine"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            tab === "mine"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          My Projects ({myProjects.length})
        </Link>
        <Link
          href="/projects?tab=all"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            tab === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          All Published ({allProjects.length})
        </Link>
      </div>

      {/* Grid */}
      {projectsToDisplay.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projectsToDisplay.map((project: ProjectItem) => {
            const openRoles = project.roles.filter((r: RoleItem) => r.isOpen).length;
            const isOwner = project.ownerId === userId;
            const applicantCount = project.applications?.length ?? 0;

            return (
              <Card
                key={project.id}
                className="bg-card border-border hover:border-primary/40 transition-colors flex flex-col justify-between rounded-2xl group shadow-xs"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isOwner ? (
                        <Badge variant="purple" className="text-[10px]">
                          Your Project
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Public Project
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                        {project.projectType}
                      </Badge>
                    </div>

                    <span className="text-xs text-muted-foreground font-medium">
                      {project.duration}
                    </span>
                  </div>

                  <CardTitle className="text-base sm:text-lg font-bold mt-2.5 line-clamp-1 group-hover:text-primary transition-colors">
                    <Link href={`/projects/${project.id}`}>{project.title}</Link>
                  </CardTitle>
                  <CardDescription className="text-xs line-clamp-2 mt-1 leading-relaxed">
                    {project.description.replace(/<[^>]*>/g, "")}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {/* Tech stack */}
                  {project.techStack && project.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.techStack.slice(0, 4).map((tech: string) => (
                        <span
                          key={tech}
                          className="text-[11px] bg-secondary text-secondary-foreground font-medium px-2 py-0.5 rounded-md border border-border"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.techStack.length > 4 && (
                        <span className="text-[10px] text-muted-foreground self-center px-1">
                          +{project.techStack.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium text-foreground">{openRoles}</span> open role{openRoles !== 1 ? "s" : ""}
                      </span>
                      {isOwner && (
                        <span className="text-muted-foreground">
                          • <span className="font-medium text-foreground">{applicantCount}</span> applicant{applicantCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                    >
                      {isOwner ? "Manage" : "View"} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<FolderGit2 className="w-6 h-6 text-primary" />}
          title={tab === "mine" ? "You haven't posted a project yet." : "No published projects found"}
          description={
            tab === "mine"
              ? "Create a project and tell potential teammates which roles you need."
              : "Be the first to publish a project for the community to discover."
          }
          actionLabel="Post a project"
          actionHref="/projects/new"
        />
      )}
    </div>
  );
}
