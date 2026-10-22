import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Link as LinkIcon, Calendar, MessageSquare, Globe, ExternalLink, FolderGit2 } from "lucide-react";
import {
  GithubIcon,
  LinkedinIcon,
  LeetCodeIcon,
  CodeforcesIcon,
  HackerRankIcon,
  KaggleIcon,
  GoogleDriveIcon,
  PdfIcon,
  PptIcon,
} from "@/components/shared/social-icons";
import sanitizeHtml from "sanitize-html";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ReviewModal } from "@/components/profile/review-modal";
import { ReviewCard } from "@/components/profile/review-card";
import { ReportModal } from "@/components/shared/report-modal";
import { ReputationBadge } from "@/components/ratings/reputation-badge";
import { calculateReputationSummary } from "@/lib/reputation/service";
import { FEEDBACK_DIMENSIONS } from "@/lib/reputation/types";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const loggedInUserId = (session?.user as { id?: string } | undefined)?.id;

  const profile = await prisma.user.findUnique({
    where: { id },
    include: {
      previousProjects: {
        orderBy: { createdAt: "desc" },
      },
      reviewsReceived: {
        include: {
          reviewer: { select: { id: true, name: true, image: true } },
          project: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!profile) {
    return notFound();
  }

  // Count verified completed collaborations
  const completedProjectsCount = await prisma.project.count({
    where: {
      OR: [
        { ownerId: profile.id },
        { applications: { some: { userId: profile.id, status: "ACCEPTED" } } },
      ],
      AND: [
        {
          OR: [{ status: "COMPLETED" }, { completedAt: { not: null } }],
        },
      ],
    },
  });

  // Calculate Bayesian reputation summary
  const reputationSummary = calculateReputationSummary(
    profile.reviewsReceived,
    completedProjectsCount
  );

  // Check if logged in user can leave a review
  let canReview = false;
  let eligibleProjects: { id: string; title: string }[] = [];

  if (loggedInUserId && loggedInUserId !== profile.id) {
    // Find completed projects where both participated (either owner or ACCEPTED application)
    const projects = await prisma.project.findMany({
      where: {
        AND: [
          {
            OR: [{ status: "COMPLETED" }, { completedAt: { not: null } }],
          },
          {
            OR: [
              {
                ownerId: loggedInUserId,
                applications: { some: { userId: profile.id, status: "ACCEPTED" } },
              },
              {
                ownerId: profile.id,
                applications: { some: { userId: loggedInUserId, status: "ACCEPTED" } },
              },
              {
                applications: {
                  some: { userId: loggedInUserId, status: "ACCEPTED" },
                },
                AND: {
                  applications: { some: { userId: profile.id, status: "ACCEPTED" } },
                },
              },
            ],
          },
        ],
      },
      select: { id: true, title: true },
    });

    // Filter out projects already reviewed
    const reviewedProjectIds = new Set(
      profile.reviewsReceived
        .filter((r) => r.reviewer.id === loggedInUserId)
        .map((r) => r.project.id)
    );

    eligibleProjects = projects.filter((p) => !reviewedProjectIds.has(p.id));
    canReview = eligibleProjects.length > 0;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent w-full" />
        <CardContent className="px-6 pb-6 pt-0 relative sm:px-8">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-end -mt-12 sm:-mt-16 mb-4">
            <Avatar
              src={profile.image || undefined}
              alt={profile.name || "User"}
              size="xl"
              className="w-24 h-24 sm:w-32 sm:h-32 ring-4 ring-background shrink-0"
            />
            <div className="flex-1 space-y-1.5 pb-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {profile.name || "Anonymous Builder"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Reputation:</span>
                  <ReputationBadge
                    score={reputationSummary.score}
                    reviewCount={reputationSummary.totalReviews}
                    showLabel
                    showCount
                    size="sm"
                  />
                </div>
                {profile.experienceLevel && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="font-medium text-foreground">{profile.experienceLevel}</span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 pb-2">
              {profile.resumeUrl && (
                <a href={profile.resumeUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary hover:bg-primary hover:text-white shadow-sm">
                    <GoogleDriveIcon className="w-4 h-4" /> View Resume / CV
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Button>
                </a>
              )}
              {loggedInUserId && loggedInUserId !== profile.id && (
                <>
                  <Link href={`/messages?userId=${profile.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <MessageSquare className="w-4 h-4" /> Message
                    </Button>
                  </Link>
                  {canReview && (
                    <ReviewModal
                      revieweeId={profile.id}
                      revieweeName={profile.name || "User"}
                      projects={eligibleProjects}
                      skills={profile.skills}
                    />
                  )}
                  <ReportModal reportedUserId={profile.id} targetName={profile.name || "User"} />
                </>
              )}
            </div>
          </div>

          {profile.bio && (
            <div 
              className="mt-6 text-foreground/90 leading-relaxed max-w-3xl prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(profile.bio) }}
            />
          )}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Skills
                </h3>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                  Self-Reported
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills.length > 0 ? (
                  profile.skills.map((s) => (
                    <Badge key={s} variant="secondary" className="px-3 py-1 text-sm bg-muted/60">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground italic">No skills listed yet.</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Profiles & Links
              </h3>
              <div className="space-y-2.5">
                {profile.resumeUrl && (
                  <a href={profile.resumeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                    <GoogleDriveIcon className="w-4 h-4 text-primary" /> Resume / CV (Google Drive)
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.githubUrl && (
                  <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-foreground/90 hover:text-primary hover:underline">
                    <GithubIcon className="w-4 h-4 text-foreground/80" /> GitHub
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                    <LinkedinIcon className="w-4 h-4 text-blue-500" /> LinkedIn
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.leetcodeUrl && (
                  <a href={profile.leetcodeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-amber-500 hover:underline">
                    <LeetCodeIcon className="w-4 h-4 text-amber-500" /> LeetCode
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.codeforcesUrl && (
                  <a href={profile.codeforcesUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-rose-500 hover:underline">
                    <CodeforcesIcon className="w-4 h-4 text-rose-500" /> Codeforces
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.hackerrankUrl && (
                  <a href={profile.hackerrankUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-emerald-500 hover:underline">
                    <HackerRankIcon className="w-4 h-4 text-emerald-500" /> HackerRank
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.kaggleUrl && (
                  <a href={profile.kaggleUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-cyan-500 hover:underline">
                    <KaggleIcon className="w-4 h-4 text-cyan-500" /> Kaggle
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.portfolioUrl && (
                  <a href={profile.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Globe className="w-4 h-4 text-primary" /> Portfolio Website
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {profile.twitterHandle && (
                  <a href={`https://twitter.com/${profile.twitterHandle.replace("@", "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-foreground/80 hover:text-primary hover:underline">
                    <LinkIcon className="w-4 h-4" /> X / Twitter (@{profile.twitterHandle.replace("@", "")})
                    <ExternalLink className="w-3 h-3 opacity-50 ml-auto" />
                  </a>
                )}
                {!profile.resumeUrl && !profile.githubUrl && !profile.linkedinUrl && !profile.leetcodeUrl && !profile.codeforcesUrl && !profile.hackerrankUrl && !profile.kaggleUrl && !profile.portfolioUrl && !profile.twitterHandle && (
                  <span className="text-sm text-muted-foreground italic">No links added yet.</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Projects & Work Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-primary" />
              Previous Projects & Proof of Work
            </h2>
            {profile.previousProjects.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {profile.previousProjects.length}
              </Badge>
            )}
          </div>
          {loggedInUserId === profile.id && (
            <Link href="/profile">
              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-primary/30 text-primary">
                Manage Projects
              </Button>
            </Link>
          )}
        </div>

        {profile.previousProjects.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-transparent">
            <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <FolderGit2 className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm">No previous projects showcased yet.</p>
              {loggedInUserId === profile.id && (
                <Link href="/profile" className="text-xs text-primary hover:underline">
                  Add your past projects and upload presentations/reports on Google Drive
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.previousProjects.map((project) => {
              const ft = (project.fileType || "").toLowerCase();
              const isPpt = ft.includes("ppt") || ft.includes("slide") || ft.includes("presentation") || ft.includes("deck");
              const isPdf = ft.includes("pdf") || ft.includes("report") || ft.includes("paper");

              return (
                <Card
                  key={project.id}
                  className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-base text-foreground leading-snug">
                          {project.title}
                        </h3>
                        {project.driveUrl && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 flex items-center gap-1 shrink-0 ${
                              isPpt
                                ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                                : isPdf
                                ? "border-rose-500/30 text-rose-500 bg-rose-500/10"
                                : "border-blue-500/30 text-blue-500 bg-blue-500/10"
                            }`}
                          >
                            {isPpt ? (
                              <PptIcon className="w-3.5 h-3.5 text-amber-500" />
                            ) : isPdf ? (
                              <PdfIcon className="w-3.5 h-3.5 text-rose-500" />
                            ) : (
                              <GoogleDriveIcon className="w-3.5 h-3.5 text-primary" />
                            )}
                            {project.fileType || "Project Document"}
                          </Badge>
                        )}
                      </div>

                      {project.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                          {project.description}
                        </p>
                      )}
                    </div>

                    {project.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {project.techStack.map((tech) => (
                          <span
                            key={tech}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/70 text-muted-foreground border border-border/40"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Links */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
                      {project.driveUrl && (
                        <a
                          href={project.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 hover:bg-primary/20 transition-colors"
                        >
                          <GoogleDriveIcon className="w-3.5 h-3.5 text-primary" />
                          {isPpt ? "View Project Slides (PPT)" : isPdf ? "View Project Report (PDF)" : "View File (Drive)"}
                          <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                        </a>
                      )}

                      {project.projectUrl && (
                        <a
                          href={project.projectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-foreground/85 hover:text-foreground hover:underline px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5 text-primary" />
                          Live Demo
                          <ExternalLink className="w-3 h-3 opacity-50 ml-0.5" />
                        </a>
                      )}

                      {project.githubUrl && (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-foreground/85 hover:text-foreground hover:underline px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <GithubIcon className="w-3.5 h-3.5 text-foreground/80" />
                          Code
                          <ExternalLink className="w-3 h-3 opacity-50 ml-0.5" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Verified Collaboration & Reputation Section */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500/20" />
              Verified Collaboration & Contributor Reputation
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Evidence-conscious peer ratings from verified, completed collaborations.
            </p>
          </div>
          {canReview && (
            <ReviewModal
              revieweeId={profile.id}
              revieweeName={profile.name || "User"}
              projects={eligibleProjects}
              skills={profile.skills}
            />
          )}
        </div>

        {/* Reputation Overview Card */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Metrics & Context */}
              <div className="space-y-4">
                <div>
                  <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                    Collaboration Standing
                  </span>
                  <div className="flex items-center gap-3 mt-1.5">
                    {reputationSummary.hasSufficientFeedback ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-foreground">
                          {reputationSummary.score}
                        </span>
                        <span className="text-sm text-muted-foreground">/ 100</span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
                        Not enough collaboration feedback yet
                      </Badge>
                    )}
                    <ReputationBadge
                      score={reputationSummary.score}
                      reviewCount={reputationSummary.totalReviews}
                      size="sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {reputationSummary.statusMessage}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Completed Projects
                    </span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {completedProjectsCount}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Verified Peer Reviews
                    </span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {reputationSummary.totalReviews}
                    </p>
                  </div>
                </div>

                {reputationSummary.repeatCollaboratorDiscountApplied && (
                  <p className="text-[11px] text-amber-500/90 italic">
                    Anti-farming safeguards active: repeated reviews from the same teammate are weighted progressively lower.
                  </p>
                )}
              </div>

              {/* Right Column: 4 Behavioral Dimensions */}
              <div className="space-y-3">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  Behavioral Dimensions Breakdown
                </span>
                <div className="space-y-2.5 pt-1">
                  {FEEDBACK_DIMENSIONS.map((dim) => {
                    const info = reputationSummary.dimensionAverages[dim.key];
                    const percent = info.count > 0 ? (info.avg / 5) * 100 : 0;

                    return (
                      <div key={dim.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{dim.label}</span>
                          <span className="text-muted-foreground text-[11px]">
                            {info.count > 0 ? (
                              <span className="font-semibold text-foreground">
                                {info.avg.toFixed(1)} / 5{" "}
                                <span className="font-normal text-muted-foreground">
                                  ({info.count} {info.count === 1 ? "rating" : "ratings"})
                                </span>
                              </span>
                            ) : (
                              <span className="italic">Not observed yet</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Fair reputation disclaimer */}
            <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
              <span className="font-semibold text-foreground flex-shrink-0">Integrity Notice:</span>
              <span>
                Peer reviews reflect subjective team collaboration experience and follow-through. They do not constitute formal technical accreditation. New contributors begin with a neutral baseline and are never penalized in match recommendations.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Reviews List */}
        {profile.reviewsReceived.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-transparent">
            <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Star className="w-8 h-8 text-muted-foreground/30" />
              <p className="font-medium">Not enough collaboration feedback yet</p>
              <p className="text-xs max-w-md">
                This contributor has not received peer reviews yet. Feedback will appear here after completing verified collaborations.
              </p>
              {canReview && (
                <div className="pt-2">
                  <ReviewModal
                    revieweeId={profile.id}
                    revieweeName={profile.name || "User"}
                    projects={eligibleProjects}
                    skills={profile.skills}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {profile.reviewsReceived.map((review) => (
              <ReviewCard
                key={review.id}
                review={review as any}
                loggedInUserId={loggedInUserId}
                revieweeName={profile.name || "User"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
