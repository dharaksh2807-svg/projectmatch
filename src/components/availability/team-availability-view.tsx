"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  Globe,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TeamAvailabilityResult } from "@/lib/scheduling/types";
import { POPULAR_IANA_TIMEZONES } from "@/lib/scheduling/timezone";

interface TeamAvailabilityViewProps {
  projectId: string;
  projectTitle: string;
  isOwner?: boolean;
  onOpenMyScheduleEditor?: () => void;
}

export function TeamAvailabilityView({
  projectId,
  projectTitle,
  onOpenMyScheduleEditor,
}: TeamAvailabilityViewProps) {
  const [data, setData] = useState<TeamAvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewer timezone state
  const [viewerTimezone, setViewerTimezone] = useState<string>(
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC"
  );

  // Range options
  const [startDateOffset, setStartDateOffset] = useState<number>(0); // 0 = today, 7 = next week

  const fetchAvailability = (tz: string, offsetDays: number) => {
    setLoading(true);
    setError(null);

    // Compute start date string
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + offsetDays);
    const startY = targetDate.getFullYear();
    const startM = String(targetDate.getMonth() + 1).padStart(2, "0");
    const startD = String(targetDate.getDate()).padStart(2, "0");
    const startDateStr = `${startY}-${startM}-${startD}`;

    const url = `/api/projects/${projectId}/availability?startDate=${startDateStr}&days=7&timezone=${encodeURIComponent(
      tz
    )}`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || body.error || "Failed to load team availability");
        }
        return res.json();
      })
      .then((json: TeamAvailabilityResult) => {
        setData(json);
      })
      .catch((err: any) => {
        console.error("Team availability fetch error:", err);
        setError(err.message || "Failed to load team availability.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAvailability(viewerTimezone, startDateOffset);
  }, [projectId, viewerTimezone, startDateOffset]);

  const handleTimezoneChange = (tz: string) => {
    setViewerTimezone(tz);
  };

  const handlePreviousWeek = () => {
    setStartDateOffset((prev) => Math.max(prev - 7, 0));
  };

  const handleNextWeek = () => {
    setStartDateOffset((prev) => prev + 7);
  };

  if (loading && !data) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Evaluating team schedules across time zones...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">{error || "Unable to display team schedule"}</p>
          <Button variant="outline" size="sm" onClick={() => fetchAvailability(viewerTimezone, startDateOffset)}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const {
    participants,
    totalMembers,
    configuredCount,
    missingCount,
    privateCount,
    allTeamOverlapMinutes,
    suggestedWindows,
    timelineSlots,
    evaluatedRange,
  } = data;

  const allTeamOverlapHours = Math.round((allTeamOverlapMinutes / 60) * 10) / 10;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Navigation & Timezone Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg text-foreground">Team Schedule Compatibility</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evaluating overlapping working hours for <span className="font-medium text-foreground">{projectTitle}</span>
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week navigation */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border border-border/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousWeek}
              disabled={startDateOffset <= 0}
              className="h-8 w-8 p-0 cursor-pointer"
              title="Previous 7 days"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium px-2 text-foreground">
              {evaluatedRange.startDate} – {evaluatedRange.endDate}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextWeek}
              className="h-8 w-8 p-0 cursor-pointer"
              title="Next 7 days"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Viewer Timezone Dropdown */}
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1 border border-border/60">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={viewerTimezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="bg-transparent text-xs text-foreground font-medium focus:outline-none cursor-pointer"
            >
              {POPULAR_IANA_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Team Member Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-4 rounded-xl bg-muted/30 border border-border/60 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
            Teammates ({totalMembers}):
          </span>
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border/60"
            >
              <Avatar src={p.image} alt={p.name || "Member"} size="sm" className="w-4 h-4" />
              <span className="font-medium text-foreground">{p.name || "Teammate"}</span>
              {p.scheduleStatus === "CONFIGURED" ? (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  {p.schedule?.timezone ? p.schedule.timezone.split("/")[1]?.replace("_", " ") || "Set" : "Configured"}
                </Badge>
              ) : p.scheduleStatus === "PRIVATE" ? (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-slate-500/10 text-slate-500 border-slate-500/20">
                  Private
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  No Schedule
                </Badge>
              )}
            </div>
          ))}
        </div>

        {onOpenMyScheduleEditor && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMyScheduleEditor}
            className="text-xs h-7 gap-1 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" /> Edit My Availability
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Configured</div>
            <div className="text-xl font-bold text-foreground mt-1">
              {configuredCount} <span className="text-xs font-normal text-muted-foreground">/ {totalMembers} members</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">All-Team Overlap</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {allTeamOverlapHours} hrs
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Suggested Windows</div>
            <div className="text-xl font-bold text-primary mt-1">
              {suggestedWindows.length} windows
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Missing / Private</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {missingCount + privateCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suggested Meeting & Coding Windows */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Suggested Coding & Meeting Windows
              </CardTitle>
              <CardDescription className="text-xs">
                Optimal overlapping time windows ranked by member participation and contiguous duration.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground font-normal">
              Showing in {viewerTimezone}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestedWindows.length === 0 ? (
            <div className="text-center p-8 rounded-xl border border-dashed border-border/80 text-muted-foreground space-y-2">
              <Calendar className="w-8 h-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">No overlapping windows found for this week</p>
              <p className="text-xs max-w-md mx-auto">
                {configuredCount < 2
                  ? "At least 2 teammates need to set their working availability to discover overlapping sync periods."
                  : "Try checking another week or fine-tuning availability intervals in your schedule editor."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestedWindows.map((win) => {
                const durationHrs = Math.round((win.durationMinutes / 60) * 10) / 10;

                return (
                  <div
                    key={win.id}
                    className={`p-4 rounded-xl border transition-all ${
                      win.isAllTeam
                        ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50"
                        : "bg-card border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {win.viewerDateLabel}
                        </div>
                        <div className="text-base font-bold text-primary mt-0.5">
                          {win.viewerTimeRangeLabel}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {win.isAllTeam ? (
                          <Badge className="bg-emerald-600 text-white text-[11px] font-semibold">
                            Full Team Overlap ({win.availableCount}/{win.totalTeamCount})
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px] font-medium">
                            {win.availableCount} of {win.totalTeamCount} available
                          </Badge>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {durationHrs} hour{durationHrs === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>

                    {/* Available members avatars */}
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Available:</span>
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {win.availableMembers.map((m) => (
                            <Avatar
                              key={m.id}
                              src={m.image}
                              alt={m.name || "Member"}
                              size="sm"
                              className="w-5 h-5 border border-background"
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-foreground ml-1">
                          {win.availableMembers.map((m) => m.name?.split(" ")[0]).join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Overlap Timeline */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Detailed Overlap Slices
          </CardTitle>
          <CardDescription className="text-xs">
            All discrete mutual working periods with participant counts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timelineSlots.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center p-4">No overlapping intervals found.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {timelineSlots.map((slot, idx) => {
                const startDate = new Date(slot.startMs);
                const endDate = new Date(slot.endMs);
                const dateLabel = new Intl.DateTimeFormat("en-US", {
                  timeZone: viewerTimezone,
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).format(startDate);

                const timeRange = `${new Intl.DateTimeFormat("en-US", {
                  timeZone: viewerTimezone,
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }).format(startDate)} – ${new Intl.DateTimeFormat("en-US", {
                  timeZone: viewerTimezone,
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }).format(endDate)}`;

                const durationHours = Math.round((slot.durationMinutes / 60) * 10) / 10;

                const memberNames = slot.availableMemberIds
                  .map((id) => participants.find((p) => p.id === id)?.name || "Member")
                  .join(", ");

                return (
                  <div key={idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-24 font-medium text-foreground shrink-0">{dateLabel}</div>
                      <div className="font-semibold text-primary">{timeRange}</div>
                      <span className="text-muted-foreground">({durationHours}h)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground truncate max-w-xs">{memberNames}</span>
                      <Badge
                        variant={slot.isAllTeam ? "default" : "secondary"}
                        className={`text-[10px] ${
                          slot.isAllTeam ? "bg-emerald-600 text-white" : ""
                        }`}
                      >
                        {slot.availableCount} of {slot.totalTeamCount}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informational Disclaimer Banner */}
      <div className="rounded-xl bg-muted/40 border border-border/60 p-4 flex items-start gap-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground">Schedule Overlap Notice</p>
          <p className="mt-0.5">
            Overlapping availability highlights potential sync and collaboration windows based on members' declared schedules.
            Overlaps are not confirmed or automated calendar appointments.
          </p>
        </div>
      </div>
    </div>
  );
}
