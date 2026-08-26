import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";
import type { Metadata } from "next";
import { ReputationBadge } from "@/components/ratings/reputation-badge";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/login");

  // Force-serialize to strip Prisma Date objects / prototypes (Error #441)
  const safeUser = JSON.parse(JSON.stringify(user));

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          {safeUser.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeUser.image}
              alt={safeUser.name || "Avatar"}
              className="w-16 h-16 rounded-2xl ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center text-white text-2xl font-bold">
              {(safeUser.name || safeUser.email || "U")[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {safeUser.name || "Complete Your Profile"}
            </h1>
            <p className="text-muted-foreground text-sm">{safeUser.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ReputationBadge score={safeUser.reputationScore} showLabel size="md" />
              <span className="text-xs text-muted-foreground">
                {safeUser.reputationScore >= 90
                  ? "— Top Rated across all projects"
                  : safeUser.reputationScore >= 75
                  ? "— Highly Rated by teammates"
                  : safeUser.reputationScore >= 60
                  ? "— Well Rated by teammates"
                  : safeUser.reputationScore === 50
                  ? "— No ratings yet (neutral)"
                  : "— Rated by teammates"}
              </span>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          Your profile is used to calculate your compatibility score for projects.
          The more complete it is, the better your matches.
        </p>
      </div>

      {/* Separator */}
      <div className="border-t border-border/50 mb-8" />

      {/* Form */}
      <ProfileForm
        initialData={{
          name: safeUser.name || "",
          skills: safeUser.skills,
          interests: safeUser.interests,
          availabilityHours: safeUser.availabilityHours || undefined,
          availabilityDuration: (safeUser.availabilityDuration as ProfileInput["availabilityDuration"]) || undefined,
          timezone: safeUser.timezone || undefined,
          experienceLevel: (safeUser.experienceLevel as ProfileInput["experienceLevel"]) || undefined,
          portfolioLinks: safeUser.portfolioLinks,
        }}
      />
    </div>
  );
}

// Type import needed for the server component
type ProfileInput = import("@/lib/validations").ProfileInput;
