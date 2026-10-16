"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Calendar,
  ExternalLink,
  Users,
  Globe,
  MapPin,
  Laptop,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Award,
  Building2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Hackathon } from "@/types";

interface HackathonCardProps {
  hackathon: Hackathon;
  variant?: "default" | "featured" | "compact";
}

/**
 * Format date range cleanly without fabricating missing dates.
 */
function formatDateRange(startStr?: string | null, endStr?: string | null): string {
  if (!startStr && !endStr) return "Dates TBA";
  if (!startStr && endStr) return `Ends ${new Date(endStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  if (startStr && !endStr) return `Starts ${new Date(startStr).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;

  const start = new Date(startStr!);
  const end = new Date(endStr!);

  const startMonth = start.toLocaleDateString([], { month: "short" });
  const startDay = start.getDate();
  const startYear = start.getFullYear();

  const endMonth = end.toLocaleDateString([], { month: "short" });
  const endDay = end.getDate();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${startYear}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
}

/**
 * Format registration deadline with urgency countdown.
 */
function formatDeadlineInfo(deadlineStr?: string | null, regStatus?: string | null) {
  if (!deadlineStr) {
    if (regStatus === "OPEN") {
      return { text: "Open (No deadline specified)", isUrgent: false, isPast: false };
    }
    return null;
  }

  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    return {
      text: `Closed on ${deadline.toLocaleDateString([], { month: "short", day: "numeric" })}`,
      isUrgent: false,
      isPast: true,
    };
  }

  if (diffHours <= 24) {
    const hours = Math.max(1, Math.floor(diffHours));
    return {
      text: `Closes in ${hours}h (${deadline.toLocaleDateString([], { month: "short", day: "numeric" })})`,
      isUrgent: true,
      isPast: false,
    };
  }

  if (diffDays <= 3) {
    return {
      text: `Closes in ${diffDays} days (${deadline.toLocaleDateString([], { month: "short", day: "numeric" })})`,
      isUrgent: true,
      isPast: false,
    };
  }

  return {
    text: `Deadline: ${deadline.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`,
    isUrgent: false,
    isPast: false,
  };
}

/**
 * Format currency and prize values safely.
 */
function formatPrize(amount?: number | null, currency?: string | null): string | null {
  if (amount == null || amount <= 0) return null;
  const curr = currency || "USD";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toLocaleString()}`;
  }
}

export function HackathonCard({ hackathon, variant = "default" }: HackathonCardProps) {
  const isNational = Boolean(hackathon.isNational);
  const isVerified = hackathon.verificationStatus === "VERIFIED";
  const isFlagged = hackathon.verificationStatus === "FLAGGED";

  // Effective status calculation
  const regStatus = (hackathon.computedRegistrationStatus || hackathon.registrationStatus || "UNKNOWN").toUpperCase();
  const deadlineInfo = useMemo(
    () => formatDeadlineInfo(hackathon.registrationDeadline, regStatus),
    [hackathon.registrationDeadline, regStatus]
  );

  const formattedPrize = useMemo(
    () => formatPrize(hackathon.prizeAmount, hackathon.prizeCurrency),
    [hackathon.prizeAmount, hackathon.prizeCurrency]
  );

  const projectCount = hackathon._count?.projects || 0;
  const openRoles = useMemo(() => {
    if (!hackathon.projects) return [];
    return hackathon.projects.flatMap((p) =>
      p.roles.map((r) => ({ ...r, projectTitle: p.title, projectId: p.id }))
    );
  }, [hackathon.projects]);

  // Combine tags and themes without duplicates
  const allTags = useMemo(() => {
    const list = [...(hackathon.tags || []), ...(hackathon.themes || [])];
    return Array.from(new Set(list.filter(Boolean)));
  }, [hackathon.tags, hackathon.themes]);

  // Mode & Location details
  const mode = hackathon.participationMode || "ONLINE";
  const locationLabel = useMemo(() => {
    const venueParts = [
      hackathon.venueAddress,
      hackathon.campusName,
      hackathon.collegeName,
      hackathon.city,
    ].filter(Boolean);
    if (venueParts.length > 0 && mode !== "ONLINE") {
      return venueParts.slice(0, 3).join(", ");
    }
    if (hackathon.city && hackathon.country) {
      return `${hackathon.city}, ${hackathon.country}`;
    }
    if (hackathon.city) return hackathon.city;
    if (hackathon.country) return hackathon.country;
    if (hackathon.location) return hackathon.location;
    if (mode === "ONLINE") return "Online / Virtual";
    return null;
  }, [
    hackathon.venueAddress,
    hackathon.campusName,
    hackathon.collegeName,
    hackathon.city,
    hackathon.country,
    hackathon.location,
    mode,
  ]);

  // Team size formatting
  const teamSizeLabel = useMemo(() => {
    const min = hackathon.minTeamSize;
    const max = hackathon.maxTeamSize;
    if (min && max) {
      return min === max ? `${min} members` : `${min}–${max} members`;
    }
    if (min) return `Min ${min} members`;
    if (max) return `Up to ${max} members`;
    return null;
  }, [hackathon.minTeamSize, hackathon.maxTeamSize]);

  // Campus badge text calculation
  const campusBadgeText = useMemo(() => {
    const isSrm =
      hackathon.collegeSlug === "srm-ist" ||
      (hackathon.collegeName && /srm/i.test(hackathon.collegeName));

    if (isSrm) {
      return "🏛️ SRM KTR Campus";
    }

    if (hackathon.collegeName && hackathon.campusName) {
      return `🏛️ ${hackathon.collegeName}, ${hackathon.campusName}`;
    }

    if (hackathon.collegeName && hackathon.city) {
      return `🏛️ ${hackathon.collegeName}, ${hackathon.city}`;
    }

    if (hackathon.campusName && hackathon.city) {
      return `🏛️ ${hackathon.campusName}, ${hackathon.city}`;
    }

    if (hackathon.collegeName) {
      return `🏛️ ${hackathon.collegeName}`;
    }

    if (hackathon.campusName) {
      return `🏛️ ${hackathon.campusName}`;
    }

    if (hackathon.stream === "COMMUNITY_LOCAL" || hackathon.isCommunitySubmitted) {
      return "🏛️ Campus Event";
    }

    return null;
  }, [
    hackathon.collegeName,
    hackathon.collegeSlug,
    hackathon.campusName,
    hackathon.city,
    hackathon.stream,
    hackathon.isCommunitySubmitted,
  ]);

  const isNationalVerified = isNational && isVerified;

  return (
    <Card
      className={cn(
        "flex flex-col justify-between relative transition-all duration-200 group overflow-hidden border font-sans",
        // Prominent distinction for verified national competitions
        (isNationalVerified || variant === "featured")
          ? "border-amber-500/50 bg-gradient-to-b from-amber-950/20 via-card/80 to-card/90 shadow-lg shadow-amber-950/20 hover:border-amber-400 hover:shadow-amber-500/10 hover:shadow-2xl ring-1 ring-amber-500/20"
          : isVerified
          ? "border-emerald-500/40 bg-card/75 backdrop-blur-sm hover:border-emerald-400/80 hover:shadow-xl hover:shadow-emerald-950/20"
          : "border-border/70 bg-card/60 backdrop-blur-sm hover:border-border hover:shadow-md"
      )}
    >
      {/* Decorative Top Accent Line */}
      <div
        className={cn(
          "h-1.5 w-full transition-all group-hover:h-2",
          (isNationalVerified || variant === "featured")
            ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-600 shadow-sm"
            : isVerified
            ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-primary"
            : "bg-gradient-to-r from-zinc-600 via-zinc-500 to-zinc-700"
        )}
      />

      {/* Optional Banner Image */}
      {hackathon.bannerUrl ? (
        <div className="relative w-full h-36 sm:h-40 overflow-hidden bg-muted/40 border-b border-border/40">
          <img
            src={hackathon.bannerUrl}
            alt={hackathon.name || "Hackathon Banner"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>
      ) : null}

      <CardHeader className="p-4 sm:p-5 pb-3 space-y-2.5">
        {/* Badges Bar: Campus, Eligibility, Organizer Tag, National, Verification, Mode */}
        <div className="flex flex-wrap items-center gap-1.5 justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Campus / Local Stream Badge: e.g. "🏛️ SRM KTR Campus" or "🏛️ IIT Madras, Chennai" */}
            {campusBadgeText && (
              <Badge
                variant="outline"
                className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[11px] px-2 py-0.5 gap-1 font-semibold"
              >
                {campusBadgeText}
              </Badge>
            )}

            {/* Organizer Club Tag: e.g. "Org: GDSC SRMIST" */}
            {(hackathon.organizerClubName || hackathon.organizerName) && (
              <Badge
                variant="outline"
                className="bg-muted text-muted-foreground border-border text-[10px] px-2 py-0.5 gap-1 font-medium"
              >
                <span className="text-muted-foreground">Org:</span>
                <span className="font-semibold text-foreground">
                  {hackathon.organizerClubName || hackathon.organizerName}
                </span>
              </Badge>
            )}

            {/* Eligibility Scope Badge (Green: Open to All, Amber: Any College Student, Blue/Purple: SRM Students Only) */}
            {hackathon.eligibilityScope === "OPEN_TO_ALL" && (
              <Badge
                variant="outline"
                className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 gap-1 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Open to All
              </Badge>
            )}
            {hackathon.eligibilityScope === "ANY_COLLEGE_STUDENT" && (
              <Badge
                variant="outline"
                className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] px-2 py-0.5 gap-1 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Any College Student
              </Badge>
            )}
            {hackathon.eligibilityScope === "HOST_COLLEGE_ONLY" && (
              <Badge
                variant="outline"
                className="bg-violet-500/15 text-violet-300 border-violet-500/30 text-[10px] px-2 py-0.5 gap-1 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                {(() => {
                  const isSrm =
                    hackathon.collegeSlug === "srm-ist" ||
                    (hackathon.collegeName && /srm/i.test(hackathon.collegeName));
                  if (isSrm) return "SRM Students Only";
                  if (hackathon.collegeName) {
                    const shortName = hackathon.collegeName.split(" ")[0];
                    return `${shortName} Students Only`;
                  }
                  return "Host College Only";
                })()}
              </Badge>
            )}

            {/* National Distinction Badge */}
            {isNationalVerified ? (
              <Badge
                variant="outline"
                className="bg-amber-500/15 text-amber-300 border-amber-500/40 font-semibold text-[11px] px-2 py-0.5 gap-1 shadow-sm"
              >
                <Award className="w-3 h-3 text-amber-400" />
                National Flagship
              </Badge>
            ) : isNational ? (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-400/90 border-amber-500/20 text-[11px] px-2 py-0.5 gap-1"
              >
                <Award className="w-3 h-3" />
                National Level
              </Badge>
            ) : isVerified ? (
              <Badge
                variant="outline"
                className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[11px] px-2 py-0.5 gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Verified
              </Badge>
            ) : null}

            {isFlagged && (
              <Badge
                variant="outline"
                className="bg-red-500/15 text-red-300 border-red-500/30 text-[10px] px-2 py-0.5 gap-1"
              >
                <AlertCircle className="w-3 h-3 text-red-400" />
                Needs Verification
              </Badge>
            )}

            {/* Mode badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] sm:text-[11px] px-2 py-0.5 gap-1 font-medium",
                mode === "ONLINE"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : mode === "OFFLINE"
                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  : "bg-teal-500/10 text-teal-400 border-teal-500/20"
              )}
            >
              {mode === "ONLINE" && <Globe className="w-3 h-3" />}
              {mode === "OFFLINE" && <MapPin className="w-3 h-3" />}
              {mode === "HYBRID" && <Laptop className="w-3 h-3" />}
              {mode === "ONLINE" ? "Online" : mode === "OFFLINE" ? "In-Person" : "Hybrid"}
            </Badge>

            {/* Registration Status Badge */}
            {regStatus === "OPEN" ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 font-semibold">
                Reg Open
              </Badge>
            ) : regStatus === "COMING_SOON" ? (
              <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] px-2 py-0.5">
                Opens Soon
              </Badge>
            ) : regStatus === "CLOSED" ? (
              <Badge variant="outline" className="bg-zinc-800/80 text-zinc-400 border-zinc-700 text-[10px] px-2 py-0.5">
                Reg Closed
              </Badge>
            ) : null}
          </div>

          {/* Teams recruiting counter */}
          {projectCount > 0 && (
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40 shrink-0">
              <Users className="w-3 h-3" />
              {projectCount} {projectCount === 1 ? "Team" : "Teams"} Recruiting
            </span>
          )}
        </div>

        {/* Title */}
        <div>
          <CardTitle className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {hackathon.name}
          </CardTitle>

          {/* Organizer info if available — never fabricate */}
          {(hackathon.organizerClubName || hackathon.organizerName) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 flex-wrap">
              <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground/80" />
              <span className="font-semibold text-foreground/90 truncate">
                Org: {hackathon.organizerClubName || hackathon.organizerName}
              </span>
              {hackathon.collegeName && (
                <span className="text-[11px] text-muted-foreground/80 truncate">
                  • {hackathon.collegeName}
                </span>
              )}
              {hackathon.organizerCredibility && (
                <span
                  className="text-[10px] px-1 py-0.2 rounded bg-muted/80 text-muted-foreground/90 shrink-0"
                  title={hackathon.organizerCredibility}
                >
                  {hackathon.organizerCredibility}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Dates & Location */}
        <div className="space-y-1 text-xs text-muted-foreground pt-0.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
            <span>{formatDateRange(hackathon.startDate, hackathon.endDate)}</span>
          </div>

          {locationLabel && (
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </div>
          )}

          {/* Deadline Countdown banner when available */}
          {deadlineInfo && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs pt-1 font-medium",
                deadlineInfo.isUrgent
                  ? "text-amber-400 font-semibold animate-pulse"
                  : deadlineInfo.isPast
                  ? "text-zinc-500"
                  : "text-emerald-400/90"
              )}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{deadlineInfo.text}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-3.5">
        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {hackathon.description || "Join fellow builders and innovators to collaborate, build prototypes, and compete."}
        </p>

        {/* Highlight Metadata Grid: Prize, Eligibility, Team Size, Free Entry */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {/* Prize pool info when available */}
          {formattedPrize && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formattedPrize}</span>
            </div>
          )}

          {/* Free entry badge */}
          {hackathon.registrationFee === 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border text-[11px]">
              <span>Free Entry</span>
            </div>
          )}

          {/* Team size limits */}
          {teamSizeLabel && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 border border-border/50 text-muted-foreground text-[11px]">
              <Users className="w-3 h-3" />
              <span>{teamSizeLabel}</span>
            </div>
          )}

          {/* Eligibility Requirement if provided */}
          {hackathon.eligibilityRequirements && (
            <div
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 border border-border/50 text-muted-foreground text-[11px] max-w-[200px] truncate"
              title={hackathon.eligibilityRequirements}
            >
              <ShieldCheck className="w-3 h-3 shrink-0" />
              <span className="truncate">{hackathon.eligibilityRequirements}</span>
            </div>
          )}
        </div>

        {/* Technology Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {allTags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-medium"
              >
                {tag}
              </span>
            ))}
            {allTags.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                +{allTags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Recruiting Roles on ProjectMatch */}
        {openRoles.length > 0 && (
          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 space-y-1.5 mt-2">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              <span>Recruiting Teams on ProjectMatch:</span>
              <span className="text-emerald-500 dark:text-emerald-400">{openRoles.length} open roles</span>
            </div>
            <div className="space-y-1">
              {openRoles.slice(0, 2).map((role) => (
                <Link
                  key={role.id}
                  href={`/projects/${role.projectId}`}
                  className="text-xs text-foreground hover:text-primary flex items-center justify-between gap-1 transition-colors truncate group/role"
                >
                  <span className="truncate group-hover/role:underline">{role.projectTitle}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 px-1.5 py-0.2 rounded bg-muted border border-border">
                    {role.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 sm:p-5 pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap bg-card/30">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Website Link */}
          {hackathon.websiteUrl && (
            <a
              href={hackathon.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-muted transition-colors border border-border/40"
              title="Official Website"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Official Site</span>
            </a>
          )}

          {/* Registration / Devpost Portal Link */}
          {(hackathon.registrationUrl || hackathon.devpostUrl) && (
            <a
              href={hackathon.registrationUrl || hackathon.devpostUrl!}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40 transition-colors"
              title="Registration Link"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Register</span>
            </a>
          )}
        </div>

        {/* Find Teammates Button */}
        {(() => {
          const isSrm =
            hackathon.collegeSlug === "srm-ist" ||
            (hackathon.collegeName && /srm/i.test(hackathon.collegeName));
          const collegePrefix = isSrm
            ? "SRM"
            : hackathon.collegeName
            ? hackathon.collegeName.split(" ")[0]
            : null;
          const buttonLabel = collegePrefix
            ? `👥 Find Teammates in ${collegePrefix}`
            : "👥 Find Teammates";

          const teamParams = new URLSearchParams();
          teamParams.set("hackathonId", hackathon.id);
          if (hackathon.collegeSlug) {
            teamParams.set("college", hackathon.collegeSlug);
          }
          if (hackathon.city) {
            teamParams.set("city", hackathon.city);
          }
          const teamsUrl = `/teams?${teamParams.toString()}`;

          return (
            <Link href={teamsUrl}>
              <Button
                size="sm"
                className="text-xs h-8 gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-sm"
              >
                <span>{buttonLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          );
        })()}
      </CardFooter>
    </Card>
  );
}
