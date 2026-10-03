import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Link as LinkIcon, CheckCircle2, Calendar, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import sanitizeHtml from "sanitize-html";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ReviewModal } from "@/components/profile/review-modal";
import { ReportModal } from "@/components/shared/report-modal";

export default async function PublicProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const loggedInUserId = (session?.user as { id?: string } | undefined)?.id;

  const profile = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
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

  // Check if logged in user can leave a review
  let canReview = false;
  let eligibleProjects: { id: string; title: string }[] = [];

  if (loggedInUserId && loggedInUserId !== profile.id) {
    // Find projects where both participated (either owner or ACCEPTED application)
    const projects = await prisma.project.findMany({
      where: {
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
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                  Reputation: <span className="font-semibold text-foreground">{profile.reputationScore}</span>
                </span>
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
            
            {loggedInUserId && loggedInUserId !== profile.id && (
              <div className="flex gap-2 pb-2">
                 <Link href={`/messages`}>
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
              </div>
            )}
          </div>

          {profile.bio && (
            <div 
              className="mt-6 text-foreground/90 leading-relaxed max-w-3xl prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(profile.bio) }}
            />
          )}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Skills
              </h3>
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
                Links
              </h3>
              <div className="space-y-2">
                {profile.portfolioUrl && (
                  <a href={profile.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <LinkIcon className="w-4 h-4" /> Portfolio
                  </a>
                )}
                 {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <LinkIcon className="w-4 h-4" /> LinkedIn
                  </a>
                )}
                 {profile.twitterHandle && (
                  <a href={`https://twitter.com/${profile.twitterHandle}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <LinkIcon className="w-4 h-4" /> Twitter (@{profile.twitterHandle})
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Reviews & Endorsements</h2>
        
        {profile.reviewsReceived.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-transparent">
             <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Star className="w-8 h-8 text-muted-foreground/30" />
              <p>No reviews yet.</p>
              {canReview && <p className="text-sm">Be the first to leave a review!</p>}
             </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {profile.reviewsReceived.map((review) => (
              <Card key={review.id} className="border-border/60 shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                       <Avatar
                        src={review.reviewer.image || undefined}
                        alt={review.reviewer.name || "Reviewer"}
                        size="sm"
                       />
                       <div>
                         <p className="font-medium text-sm text-foreground">
                           {review.reviewer.name || "Anonymous"}
                         </p>
                         <p className="text-xs text-muted-foreground">
                           Project: <span className="font-medium text-foreground/80">{review.project.title}</span> • {formatDistanceToNow(new Date(review.createdAt))} ago
                         </p>
                       </div>
                    </div>
                    <div className="flex text-amber-500 items-center">
                       {[...Array(5)].map((_, i) => (
                         <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? "fill-amber-500" : "fill-muted text-muted"}`} />
                       ))}
                    </div>
                  </div>

                  {review.content && (
                    <p className="text-sm text-foreground/90 leading-relaxed italic">
                      "{review.content}"
                    </p>
                  )}

                  {review.skillsEndorsed.length > 0 && (
                     <div className="pt-2 flex flex-wrap gap-2 items-center">
                       <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                         <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                         Endorsed for:
                       </span>
                       {review.skillsEndorsed.map((s) => (
                         <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                           {s}
                         </Badge>
                       ))}
                     </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
