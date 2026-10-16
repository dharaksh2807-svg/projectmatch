"use client";

import {
  Search,
  X,
  SlidersHorizontal,
  Award,
  Clock,
  RotateCcw,
  Globe,
  MapPin,
  Laptop,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const TECH_CATEGORIES = [
  "All",
  "AI & ML",
  "Web3",
  "Cloud & DevOps",
  "Open Source",
  "Mobile & Web",
  "Social Good",
  "Cybersecurity",
];

export type ParticipationModeFilter = "ALL" | "ONLINE" | "OFFLINE" | "HYBRID";
export type SortOption = "ranked" | "deadline" | "startDate" | "prize";

interface HackathonFiltersProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedMode: ParticipationModeFilter;
  onModeChange: (mode: ParticipationModeFilter) => void;
  nationalOnly: boolean;
  onNationalChange: (val: boolean) => void;
  openRegOnly: boolean;
  onOpenRegChange: (val: boolean) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  totalCount?: number;
}

export function HackathonFilters({
  searchQuery,
  onSearchChange,
  selectedMode,
  onModeChange,
  nationalOnly,
  onNationalChange,
  openRegOnly,
  onOpenRegChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  onResetFilters,
  hasActiveFilters,
  totalCount,
}: HackathonFiltersProps) {
  return (
    <div className="space-y-4 font-sans">
      {/* ── TOP BAR: Search & Sort ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search hackathons, organizers, topics, or cities..."
            className="pl-9 pr-9 bg-card/70 text-sm h-10 border-border/70 rounded-xl focus:border-emerald-500/60"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Selector & Reset */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-card/60 border border-border/70 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-muted-foreground font-medium shrink-0">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="ranked" className="bg-zinc-900 text-white">
                Priority Ranked (Default)
              </option>
              <option value="deadline" className="bg-zinc-900 text-white">
                Registration Deadline (Soonest)
              </option>
              <option value="startDate" className="bg-zinc-900 text-white">
                Event Start Date (Soonest)
              </option>
              <option value="prize" className="bg-zinc-900 text-white">
                Prize Pool (Highest)
              </option>
            </select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 border-border/60"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── FILTER TOGGLES & PILLS ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-b border-border/40 pb-3">
        {/* Left Side: Specific Feature Toggles (National, Reg Open, Mode) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* National Level Toggle Button */}
          <button
            onClick={() => onNationalChange(!nationalOnly)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border",
              nationalOnly
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-950/30 ring-1 ring-amber-500/30"
                : "bg-card/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-muted/50"
            )}
          >
            <Award className={cn("w-3.5 h-3.5", nationalOnly ? "text-amber-400" : "text-muted-foreground")} />
            National Level
            {nationalOnly && <Badge className="bg-amber-500/30 text-amber-200 text-[10px] px-1 py-0 ml-0.5">Active</Badge>}
          </button>

          {/* Registration Open Only Toggle */}
          <button
            onClick={() => onOpenRegChange(!openRegOnly)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border",
              openRegOnly
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/30"
                : "bg-card/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-muted/50"
            )}
          >
            <Clock className={cn("w-3.5 h-3.5", openRegOnly ? "text-emerald-400" : "text-muted-foreground")} />
            Registration Open
            {openRegOnly && <Badge className="bg-emerald-500/30 text-emerald-200 text-[10px] px-1 py-0 ml-0.5">Active</Badge>}
          </button>

          {/* Participation Mode Segmented Pills */}
          <div className="flex items-center p-0.5 rounded-xl bg-card/60 border border-border/60">
            {(
              [
                { id: "ALL", label: "All Modes", icon: null },
                { id: "ONLINE", label: "Online", icon: Globe },
                { id: "OFFLINE", label: "In-Person", icon: MapPin },
                { id: "HYBRID", label: "Hybrid", icon: Laptop },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isSelected = selectedMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onModeChange(item.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Count Indicator */}
        {totalCount !== undefined && (
          <span className="text-xs text-muted-foreground/80 font-medium">
            {totalCount} {totalCount === 1 ? "event" : "events"} found
          </span>
        )}
      </div>

      {/* ── TECHNOLOGY CATEGORY CHIPS ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs text-muted-foreground font-medium shrink-0 mr-1 flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" />
          Tech:
        </span>
        {TECH_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border shrink-0",
                isSelected
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                  : "bg-card/60 text-muted-foreground border-border/50 hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
