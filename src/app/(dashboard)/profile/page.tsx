import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";
import { ExternalLink } from "lucide-react";
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

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name || "Avatar"}
              className="w-16 h-16 rounded-2xl ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center text-white text-2xl font-bold">
              {(user.name || user.email || "U")[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {user.name || "Complete Your Profile"}
            </h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ReputationBadge score={user.reputationScore} showLabel size="md" />
              <span className="text-xs text-muted-foreground">
                {user.reputationScore >= 90
                  ? "— Top Rated across all projects"
                  : user.reputationScore >= 75
                  ? "— Highly Rated by teammates"
                  : user.reputationScore >= 60
                  ? "— Well Rated by teammates"
                  : user.reputationScore === 50
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
          name: user.name || "",
          skills: user.skills,
          interests: user.interests,
          availabilityHours: user.availabilityHours || undefined,
          availabilityDuration: (user.availabilityDuration as ProfileInput["availabilityDuration"]) || undefined,
          timezone: user.timezone || undefined,
          experienceLevel: (user.experienceLevel as ProfileInput["experienceLevel"]) || undefined,
          portfolioLinks: user.portfolioLinks,
        }}
      />
    </div>
  );
}

// Type import needed for the server component
type ProfileInput = import("@/lib/validations").ProfileInput;
