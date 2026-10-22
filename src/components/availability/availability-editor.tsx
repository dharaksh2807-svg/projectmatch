"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  Globe,
  Lock,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import {
  AvailabilityVisibility,
  DateOverride,
  UserScheduleData,
  WeeklyDaySlot,
} from "@/lib/scheduling/types";
import { AVAILABILITY_PRESETS, calculateWeeklyHours, createDefaultWeeklySlots } from "@/lib/scheduling/presets";
import { POPULAR_IANA_TIMEZONES } from "@/lib/scheduling/timezone";

const DAYS_OF_WEEK = [
  { day: 1, name: "Monday", short: "Mon" },
  { day: 2, name: "Tuesday", short: "Tue" },
  { day: 3, name: "Wednesday", short: "Wed" },
  { day: 4, name: "Thursday", short: "Thu" },
  { day: 5, name: "Friday", short: "Fri" },
  { day: 6, name: "Saturday", short: "Sat" },
  { day: 7, name: "Sunday", short: "Sun" },
];

// Generate 30-minute time intervals for select options ("00:00", "00:30", ..., "23:30")
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, "0");
  TIME_OPTIONS.push(`${hh}:00`);
  TIME_OPTIONS.push(`${hh}:30`);
}

interface AvailabilityEditorProps {
  initialSchedule?: UserScheduleData | null;
  onSaved?: (schedule: UserScheduleData) => void;
}

export function AvailabilityEditor({ initialSchedule, onSaved }: AvailabilityEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(!initialSchedule);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"weekly" | "overrides">("weekly");

  const [timezone, setTimezone] = useState<string>("UTC");
  const [visibility, setVisibility] = useState<AvailabilityVisibility>("TEAM_ONLY");
  const [weeklySlots, setWeeklySlots] = useState<WeeklyDaySlot[]>(createDefaultWeeklySlots());
  const [overrides, setOverrides] = useState<DateOverride[]>([]);

  // Override creation form state
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [newOverrideIsUnavailable, setNewOverrideIsUnavailable] = useState(false);
  const [newOverrideStart, setNewOverrideStart] = useState("09:00");
  const [newOverrideEnd, setNewOverrideEnd] = useState("18:00");
  const [newOverrideNote, setNewOverrideNote] = useState("");

  useEffect(() => {
    if (initialSchedule) {
      setTimezone(initialSchedule.timezone || "UTC");
      setVisibility(initialSchedule.visibility || "TEAM_ONLY");
      setWeeklySlots(initialSchedule.weeklySlots?.length ? initialSchedule.weeklySlots : createDefaultWeeklySlots());
      setOverrides(initialSchedule.overrides || []);
      setLoading(false);
    } else {
      fetch("/api/availability/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.schedule) {
            setTimezone(data.schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
            setVisibility(data.schedule.visibility || "TEAM_ONLY");
            setWeeklySlots(data.schedule.weeklySlots?.length ? data.schedule.weeklySlots : createDefaultWeeklySlots());
            setOverrides(data.schedule.overrides || []);
          }
        })
        .catch((err) => {
          console.error("Failed to load schedule:", err);
          toast("Failed to load availability schedule.", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [initialSchedule]);

  // Compute total weekly hours
  const totalWeeklyHours = calculateWeeklyHours(weeklySlots);

  // Apply a preset
  const applyPreset = (presetId: string) => {
    const preset = AVAILABILITY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setWeeklySlots(JSON.parse(JSON.stringify(preset.slots)));
    toast(`Applied '${preset.name}' preset. You can fine-tune any slot!`, "success");
  };

  const clearAllSlots = () => {
    setWeeklySlots(createDefaultWeeklySlots());
    toast("Cleared all weekly availability slots.", "info");
  };

  // Add interval to a specific day
  const addIntervalToDay = (dayOfWeek: number) => {
    setWeeklySlots((prev) =>
      prev.map((slot) => {
        if (slot.dayOfWeek !== dayOfWeek) return slot;
        const currentIntervals = slot.intervals || [];
        const nextStart = currentIntervals.length > 0 ? "18:00" : "09:00";
        const nextEnd = currentIntervals.length > 0 ? "22:00" : "17:00";
        return {
          ...slot,
          intervals: [...currentIntervals, { start: nextStart, end: nextEnd }],
        };
      })
    );
  };

  // Remove interval from a specific day
  const removeIntervalFromDay = (dayOfWeek: number, index: number) => {
    setWeeklySlots((prev) =>
      prev.map((slot) => {
        if (slot.dayOfWeek !== dayOfWeek) return slot;
        const filtered = (slot.intervals || []).filter((_, i) => i !== index);
        return { ...slot, intervals: filtered };
      })
    );
  };

  // Update interval time
  const updateIntervalTime = (
    dayOfWeek: number,
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    setWeeklySlots((prev) =>
      prev.map((slot) => {
        if (slot.dayOfWeek !== dayOfWeek) return slot;
        const updated = (slot.intervals || []).map((interval, i) => {
          if (i !== index) return interval;
          return { ...interval, [field]: value };
        });
        return { ...slot, intervals: updated };
      })
    );
  };

  // Add date override
  const handleAddOverride = () => {
    if (!newOverrideDate) {
      toast("Please select a date for the override.", "error");
      return;
    }

    const newOverride: DateOverride = {
      date: newOverrideDate,
      isUnavailable: newOverrideIsUnavailable,
      intervals: newOverrideIsUnavailable
        ? []
        : [{ start: newOverrideStart, end: newOverrideEnd }],
      note: newOverrideNote.trim() || undefined,
    };

    setOverrides((prev) => [...prev.filter((o) => o.date !== newOverrideDate), newOverride]);
    setNewOverrideDate("");
    setNewOverrideNote("");
    setNewOverrideIsUnavailable(false);
    toast("Added date-specific availability override.", "success");
  };

  const removeOverride = (date: string) => {
    setOverrides((prev) => prev.filter((o) => o.date !== date));
    toast("Removed date override.", "info");
  };

  // Save schedule
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/availability/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          visibility,
          weeklySlots,
          overrides,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save schedule");
      }

      toast("Working schedule saved successfully!", "success");
      if (onSaved) {
        onSaved(data.schedule);
      }
    } catch (err: any) {
      console.error("Save error:", err);
      toast(err?.message || "Failed to save schedule.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Status Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Working Availability & Schedule
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set your recurring active hours to discover overlap with hackathon teammates across time zones.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="px-3 py-1 text-sm bg-primary/5 text-primary border-primary/20 font-medium">
            {totalWeeklyHours} hrs / week
          </Badge>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="brand-gradient text-white gap-2 cursor-pointer shadow-xs"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Schedule
          </Button>
        </div>
      </div>

      {/* Timezone & Privacy Controls Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IANA Timezone Selector */}
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Your Primary Time Zone (IANA)
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {POPULAR_IANA_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.value})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Preserves your local wall-clock hours while translating cleanly to your teammates' clocks.
            </p>
          </CardContent>
        </Card>

        {/* Visibility / Privacy Selector */}
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Schedule Privacy
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as AvailabilityVisibility)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="TEAM_ONLY">Team Only (Visible strictly to teammates in accepted projects)</option>
              <option value="PUBLIC">Public (Visible to everyone on discover & profile)</option>
              <option value="PRIVATE">Private (Only you can see exact slots)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              By default, exact working intervals are visible only to accepted teammates and project leads.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "weekly"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Weekly Recurring Schedule
        </button>
        <button
          onClick={() => setActiveTab("overrides")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "overrides"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Date-Specific Overrides {overrides.length > 0 && `(${overrides.length})`}
        </button>
      </div>

      {/* TAB 1: WEEKLY RECURRING SCHEDULE */}
      {activeTab === "weekly" && (
        <div className="space-y-5">
          {/* Presets Bar */}
          <div className="rounded-xl bg-muted/40 border border-border/60 p-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Quick Presets (Editable)
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {AVAILABILITY_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset.id)}
                  className="text-xs bg-background hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                >
                  {preset.name}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllSlots}
                className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Days of the Week Grid */}
          <div className="space-y-3">
            {DAYS_OF_WEEK.map((d) => {
              const daySlot = weeklySlots.find((s) => s.dayOfWeek === d.day) || {
                dayOfWeek: d.day,
                intervals: [],
              };
              const intervals = daySlot.intervals || [];

              return (
                <div
                  key={d.day}
                  className="rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-border flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Day Info */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {d.short}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {intervals.length === 0 ? "Unavailable" : `${intervals.length} interval(s)`}
                      </div>
                    </div>
                  </div>

                  {/* Intervals list */}
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    {intervals.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">No working hours set</span>
                    ) : (
                      intervals.map((interval, idx) => {
                        const startH = parseInt(interval.start.split(":")[0], 10);
                        const endH = parseInt(interval.end.split(":")[0], 10);
                        const isCrossMidnight = endH < startH;

                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-muted/60 border border-border/60 text-xs text-foreground"
                          >
                            <select
                              value={interval.start}
                              onChange={(e) =>
                                updateIntervalTime(d.day, idx, "start", e.target.value)
                              }
                              className="bg-background border border-input rounded px-1.5 py-1 text-xs focus:outline-none"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            <span className="text-muted-foreground">to</span>
                            <select
                              value={interval.end}
                              onChange={(e) =>
                                updateIntervalTime(d.day, idx, "end", e.target.value)
                              }
                              className="bg-background border border-input rounded px-1.5 py-1 text-xs focus:outline-none"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>

                            {isCrossMidnight && (
                              <Badge variant="secondary" className="px-1 text-[10px] bg-primary/10 text-primary">
                                +1 day
                              </Badge>
                            )}

                            <button
                              onClick={() => removeIntervalFromDay(d.day, idx)}
                              className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                              title="Remove interval"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addIntervalToDay(d.day)}
                    className="shrink-0 gap-1 text-xs h-8 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Slot
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: DATE-SPECIFIC OVERRIDES */}
      {activeTab === "overrides" && (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 flex items-start gap-3 text-sm text-foreground">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Hackathon & Specific Date Exceptions</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Override your standard weekly schedule for specific hackathon sprint dates, demo days, or personal leave.
              </p>
            </div>
          </div>

          {/* Add Override Form */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Add Date Override</CardTitle>
              <CardDescription className="text-xs">
                Specify a date and choose whether you are unavailable or working special hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Date</label>
                  <input
                    type="date"
                    value={newOverrideDate}
                    onChange={(e) => setNewOverrideDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  />
                </div>

                {/* Status Toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Status</label>
                  <select
                    value={newOverrideIsUnavailable ? "unavailable" : "custom"}
                    onChange={(e) => setNewOverrideIsUnavailable(e.target.value === "unavailable")}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                  >
                    <option value="custom">Available with Custom Hours</option>
                    <option value="unavailable">Completely Unavailable</option>
                  </select>
                </div>

                {/* Hours if custom */}
                {!newOverrideIsUnavailable && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">Start Time</label>
                      <select
                        value={newOverrideStart}
                        onChange={(e) => setNewOverrideStart(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">End Time</label>
                      <select
                        value={newOverrideEnd}
                        onChange={(e) => setNewOverrideEnd(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Hackathon Final Sprint, All-Night Coding, Personal Day"
                  value={newOverrideNote}
                  onChange={(e) => setNewOverrideNote(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleAddOverride} size="sm" className="gap-1.5 cursor-pointer">
                  <Plus className="w-4 h-4" /> Add Date Exception
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Overrides List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Configured Overrides</h3>
            {overrides.length === 0 ? (
              <div className="text-sm text-muted-foreground p-6 rounded-xl border border-dashed border-border text-center">
                No date-specific overrides configured. Your recurring weekly schedule applies to all dates.
              </div>
            ) : (
              overrides.map((ov) => (
                <div
                  key={ov.date}
                  className="flex items-center justify-between p-3.5 px-4 rounded-xl border border-border/60 bg-card text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary" />
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {ov.date}
                        {ov.note && (
                          <span className="text-xs font-normal text-muted-foreground">({ov.note})</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ov.isUnavailable ? (
                          <span className="text-destructive font-medium">Unavailable all day</span>
                        ) : (
                          ov.intervals?.map((i) => `${i.start} – ${i.end}`).join(", ") || "No hours"
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOverride(ov.date)}
                    className="text-muted-foreground hover:text-destructive h-8 px-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
