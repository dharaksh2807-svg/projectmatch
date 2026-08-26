import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Plus,
  Search,
  Users,
  Star,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

const quickActions = [
  {
    href: "/profile",
    icon: <Star className="w-5 h-5 text-white" />,
    label: "Complete Profile",
    description: "Add skills & availability to get matched",
    accent: "from-violet-500/20 to-primary/20",
    iconBg: "brand-gradient",
  },
  {
    href: "/projects/new",
    icon: <Plus className="w-5 h-5 text-white" />,
    label: "Post a Project",
    description: "Define roles and find your team",
    accent: "from-emerald-500/20 to-teal-500/20",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
  },
  {
    href: "/discover",
    icon: <Search className="w-5 h-5 text-white" />,
    label: "Discover Projects",
    description: "Explore open roles matched to your skills",
    accent: "from-orange-500/20 to-yellow-500/20",
    iconBg: "bg-gradient-to-br from-orange-500 to-yellow-500",
  },
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const rawUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      projectsOwned: {
        include: { roles: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      applications: {
        include: { role: { include: { project: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  // Phase 2: Sanitize Prisma result into a plain serializable object.
  // Prisma returns objects with hidden prototype getters and Date instances
  // that crash the Vercel RSC minifier (Error 441) during serialization.
  const user = rawUser
    ? {
        id: rawUser.id,
        name: rawUser.name,
        email: rawUser.email,
        skills: rawUser.skills,
        interests: rawUser.interests,
        experienceLevel: rawUser.experienceLevel,
        availabilityHours: rawUser.availabilityHours,
        portfolioLinks: rawUser.portfolioLinks,
        reputationScore: rawUser.reputationScore,
        projectsOwned: rawUser.projectsOwned.map((p) => ({
          id: p.id,
          title: p.title,
          createdAt: p.createdAt.toISOString(),
          roles: p.roles.map((r) => ({ id: r.id, title: r.title })),
        })),
        applications: rawUser.applications.map((a) => ({
          id: a.id,
          status: a.status,
          role: {
            id: a.role.id,
            title: a.role.title,
            projectId: a.role.projectId,
            project: {
              id: a.role.project.id,
              title: a.role.project.title,
            },
          },
        })),
      }
    : null;

  const hasProfile =
    user && user.skills.length > 0 && user.experienceLevel;
  const profileCompletion = user
    ? Math.round(
        ([
          user.name,
          user.skills.length > 0,
          user.interests.length > 0,
          user.availabilityHours,
          user.experienceLevel,
          user.portfolioLinks.length > 0,
        ].filter(Boolean).length /
          6) *
          100
      )
    : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          Welcome back,{" "}
          <span className="brand-gradient-text">
            {session?.user?.name?.split(" ")[0] || "Builder"}
          </span>{" "}
          👋
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your projects and matches.
        </p>
      </div>

      {/* Profile completion banner */}
      {!hasProfile && (
        <div className="mb-8 rounded-2xl brand-gradient p-px glow">
          <div className="bg-background rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Complete your profile to get matched</p>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full brand-gradient rounded-full transition-all duration-500"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {profileCompletion}% complete
                </span>
              </div>
            </div>
            <Link
              href="/profile"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg brand-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
            >
              Complete <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: <Users className="w-5 h-5 text-primary mb-3" />,
            label: "Projects Owned",
            value: user?.projectsOwned.length ?? 0,
          },
          {
            icon: <TrendingUp className="w-5 h-5 text-emerald-400 mb-3" />,
            label: "Applications",
            value: user?.applications.length ?? 0,
          },
          {
            icon: <Star className="w-5 h-5 text-yellow-400 mb-3" />,
            label: "Reputation",
            value: user?.reputationScore.toFixed(1) ?? "—",
          },
          {
            icon: <Clock className="w-5 h-5 text-blue-400 mb-3" />,
            label: "Availability",
            value: user?.availabilityHours ? `${user.availabilityHours}h/wk` : "Not set",
          },
        ].map(({ icon, label, value }) => (
          <div key={label} className="glass-card rounded-2xl p-5 border border-border/50">
            {icon}
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {quickActions.map(({ href, icon, label, description, accent, iconBg }) => (
            <Link
              key={href}
              href={href}
              className={`group glass-card rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br ${accent}`}
            >
              <div
                className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                {icon}
              </div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Two-column: Recent Projects & Applications */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* My Projects */}
        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="font-semibold">My Projects</h2>
            <Link
              href="/projects"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {user?.projectsOwned && user.projectsOwned.length > 0 ? (
              <div className="space-y-3">
                {user.projectsOwned.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg brand-gradient flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {project.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {project.roles.length} role{project.roles.length !== 1 ? "s" : ""} open
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl glass border border-border mx-auto flex items-center justify-center mb-3">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No projects yet</p>
                <Link
                  href="/projects/new"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  Post your first project <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Applications */}
        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="font-semibold">Applications</h2>
            <Link
              href="/applications"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {user?.applications && user.applications.length > 0 ? (
              <div className="space-y-3">
                {user.applications.map((app) => (
                  <Link
                    key={app.id}
                    href={`/projects/${app.role.projectId}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {app.role.project.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{app.role.title}</p>
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
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl glass border border-border mx-auto flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No applications yet</p>
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  Browse projects <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

