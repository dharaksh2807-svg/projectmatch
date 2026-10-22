import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvailabilityEditor } from "@/components/availability/availability-editor";
import type { Metadata } from "next";
import { ReputationBadge } from "@/components/ratings/reputation-badge";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      previousProjects: {
        orderBy: { createdAt: "desc" },
      },
      reviewsReceived: {
        select: { id: true, rating: true },
      },
    },
  });

  if (!user) redirect("/login");

  // Force-serialize to strip Prisma Date objects / prototypes (Error #441)
  const safeUser = JSON.parse(JSON.stringify(user));
  const reviewCount = safeUser.reviewsReceived?.length || 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto animate-fade-in min-w-0 overflow-x-hidden space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {safeUser.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeUser.image}
              alt={safeUser.name || "Avatar"}
              className="w-16 h-16 rounded-2xl ring-2 ring-primary/20 object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
              {(safeUser.name || safeUser.email || "U")[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
              {safeUser.name || "Complete Your Profile"}
            </h1>
            <p className="text-muted-foreground text-sm truncate">{safeUser.email}</p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {reviewCount === 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  ★ No reviews yet
                </span>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <ReputationBadge score={safeUser.reputationScore} showLabel size="md" />
                  <span className="text-xs text-muted-foreground">
                    ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                • Public Profile visible to project collaborators
              </span>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-sm mt-4 pt-4 border-t border-border/60">
          Your profile details power the ProjectMatch compatibility algorithm. Keep your skills, availability, and proof-of-work up to date for higher-quality teammate recommendations.
        </p>
      </div>

      {/* Form */}
      <ProfileForm
        initialData={{
          name: safeUser.name || "",
          bio: safeUser.bio || "",
          skills: safeUser.skills || [],
          experienceLevel: safeUser.experienceLevel || null,
          availability: safeUser.availability || null,
          timezone: safeUser.timezone || "UTC+5:30 (IST)",
          portfolioUrl: safeUser.portfolioUrl || "",
          linkedinUrl: safeUser.linkedinUrl || "",
          githubUrl: safeUser.githubUrl || "",
          leetcodeUrl: safeUser.leetcodeUrl || "",
          codeforcesUrl: safeUser.codeforcesUrl || "",
          hackerrankUrl: safeUser.hackerrankUrl || "",
          kaggleUrl: safeUser.kaggleUrl || "",
          resumeUrl: safeUser.resumeUrl || "",
          twitterHandle: safeUser.twitterHandle || "",
          instagramHandle: safeUser.instagramHandle || "",
          phoneNumber: safeUser.phoneNumber || "",
          previousProjects: safeUser.previousProjects || [],
        }}
      />

      {/* ── Working Schedule & Timezone Overlap Editor ── */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <AvailabilityEditor />
      </div>
    </div>
  );
}

