"use client";

import {
  Search,
  X,
  SlidersHorizontal,
  Award,
  RotateCcw,
  Globe,
  MapPin,
  Laptop,
  Building2,
  GraduationCap,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EligibilityScopeFilter } from "@/hooks/useHackathons";

// ── Dropdown Options ─────────────────────────────────────────────────────────

export const CITY_OPTIONS = [
  { label: "All Cities", value: "ALL" },
  { label: "Chennai", value: "Chennai" },
  { label: "Bengaluru", value: "Bengaluru" },
  { label: "Delhi NCR", value: "Delhi NCR" },
  { label: "Hyderabad", value: "Hyderabad" },
  { label: "Pune", value: "Pune" },
  { label: "Mumbai", value: "Mumbai" },
] as const;

export const COLLEGE_OPTIONS = [
  { label: "All Colleges", value: "ALL" },
  { label: "SRMIST (Kattankulathur)", value: "srm-ist" },
  { label: "IIT Madras", value: "iit-madras" },
  { label: "Anna University", value: "anna-univ" },
  { label: "VIT Chennai", value: "vit-chennai" },
  { label: "SSN College", value: "ssn" },
] as const;

export const ELIGIBILITY_OPTIONS = [
  { label: "All Eligibilities", value: "ALL" },
  { label: "Open to All", value: "OPEN_TO_ALL" },
  { label: "Any College Student", value: "ANY_COLLEGE_STUDENT" },
  { label: "Host College Only", value: "HOST_COLLEGE_ONLY" },
] as const;

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
  // Location & eligibility
  selectedCollege?: string;
  onCollegeChange?: (slug: string) => void;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
  selectedEligibility?: EligibilityScopeFilter;
  onEligibilityChange?: (scope: EligibilityScopeFilter) => void;
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
  totalCount: _totalCount,
  selectedCollege = "ALL",
  onCollegeChange,
  selectedCity = "ALL",
  onCityChange,
  selectedEligibility = "ALL",
  onEligibilityChange,
}: HackathonFiltersProps) {
  // Handlers for 1-Click Quick Scope Pills
  const handleQuickSrm = () => {
    if (!onCollegeChange) return;
    onCollegeChange(selectedCollege === "srm-ist" ? "ALL" : "srm-ist");
  };

  const handleQuickChennai = () => {
    if (!onCityChange) return;
    if (selectedCity === "Chennai") {
      onCityChange("ALL");
    } else {
      onCityChange("Chennai");
      onCollegeChange?.("ALL"); // clears college filter as required
    }
  };

  const handleQuickOnline = () => {
    onModeChange(selectedMode === "ONLINE" ? "ALL" : "ONLINE");
  };

  const handleQuickOpenReg = () => {
    onOpenRegChange(!openRegOnly);
  };

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
            placeholder="Search hackathons, organizers, colleges, or topics..."
            className="pl-9 pr-9 bg-card text-sm h-10 border-border rounded-xl focus:border-primary"
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

        {/* Sort Selector & Reset Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-xl text-xs">
            <span className="text-muted-foreground font-medium shrink-0">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="bg-transparent text-foreground font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="ranked" className="bg-popover text-popover-foreground">
                Smart Relevance (Default)
              </option>
              <option value="deadline" className="bg-popover text-popover-foreground">
                Registration Deadline (Soonest)
              </option>
              <option value="startDate" className="bg-popover text-popover-foreground">
                Event Start Date (Soonest)
              </option>
              <option value="prize" className="bg-popover text-popover-foreground">
                Prize Pool (Highest)
              </option>
            </select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 border-border"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── 1-CLICK QUICK SCOPE PILLS ── */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-border pb-3">
        <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Quick Scope:
        </span>

        {/* [ 🏛️ At SRM (Campus) ] */}
        {onCollegeChange && (
          <button
            onClick={handleQuickSrm}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0",
              selectedCollege === "srm-ist"
                ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 font-bold"
                : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
            )}
          >
            <span>🏛️</span>
            <span>At SRM (Campus)</span>
            {selectedCollege === "srm-ist" && (
              <Badge className="bg-purple-600 text-white dark:bg-purple-800 text-[10px] px-1 py-0 ml-0.5">Active</Badge>
            )}
          </button>
        )}

        {/* [ 📍 In Chennai (City) ] */}
        {onCityChange && (
          <button
            onClick={handleQuickChennai}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0",
              selectedCity === "Chennai" && selectedCollege === "ALL"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-bold"
                : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
            )}
          >
            <span>📍</span>
            <span>In Chennai (City)</span>
            {selectedCity === "Chennai" && selectedCollege === "ALL" && (
              <Badge className="bg-emerald-600 text-white dark:bg-emerald-800 text-[10px] px-1 py-0 ml-0.5">Active</Badge>
            )}
          </button>
        )}

        {/* [ 🌐 Online / Virtual ] */}
        <button
          onClick={handleQuickOnline}
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0",
            selectedMode === "ONLINE"
              ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-bold"
              : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
          )}
        >
          <span>🌐</span>
          <span>Online / Virtual</span>
          {selectedMode === "ONLINE" && (
            <Badge className="bg-blue-600 text-white dark:bg-blue-800 text-[10px] px-1 py-0 ml-0.5">Active</Badge>
          )}
        </button>

        {/* [ ⚡ Open Reg Only ] */}
        <button
          onClick={handleQuickOpenReg}
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0",
            openRegOnly
              ? "bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 font-bold"
              : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
          )}
        >
          <span>⚡</span>
          <span>Open Reg Only</span>
          {openRegOnly && (
            <Badge className="bg-teal-600 text-white dark:bg-teal-800 text-[10px] px-1 py-0 ml-0.5">Active</Badge>
          )}
        </button>

        {/* National Flagships Toggle */}
        <button
          onClick={() => onNationalChange(!nationalOnly)}
          className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border shrink-0",
            nationalOnly
              ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-bold"
              : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
          )}
        >
          <Award className={cn("w-3.5 h-3.5", nationalOnly ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
          <span>National Flagships</span>
          {nationalOnly && (
            <Badge className="bg-amber-600 text-white dark:bg-amber-800 text-[10px] px-1 py-0 ml-0.5">Active</Badge>
          )}
        </button>

        {/* Participation Mode Segmented Pills */}
        <div className="flex items-center p-0.5 rounded-xl bg-card border border-border ml-auto">
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
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
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

      {/* ── WORKING DROPDOWN FILTERS (City, College, Eligibility) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* City Selector Dropdown */}
        {onCityChange && (
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl focus-within:border-primary transition-colors">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">City</span>
              <select
                value={selectedCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer truncate"
              >
                {CITY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value} className="bg-popover text-popover-foreground">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedCity !== "ALL" && (
              <button
                onClick={() => onCityChange("ALL")}
                className="text-muted-foreground hover:text-foreground p-1"
                title="Clear city filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* College Selector Dropdown */}
        {onCollegeChange && (
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl focus-within:border-primary transition-colors">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">College</span>
              <select
                value={selectedCollege}
                onChange={(e) => onCollegeChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer truncate"
              >
                {COLLEGE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value} className="bg-popover text-popover-foreground">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedCollege !== "ALL" && (
              <button
                onClick={() => onCollegeChange("ALL")}
                className="text-muted-foreground hover:text-foreground p-1"
                title="Clear college filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Eligibility Selector Dropdown */}
        {onEligibilityChange && (
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-xl focus-within:border-primary transition-colors">
            <GraduationCap className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Eligibility</span>
              <select
                value={selectedEligibility}
                onChange={(e) => onEligibilityChange(e.target.value as EligibilityScopeFilter)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer truncate"
              >
                {ELIGIBILITY_OPTIONS.map((e) => (
                  <option key={e.value} value={e.value} className="bg-popover text-popover-foreground">
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            {selectedEligibility !== "ALL" && (
              <button
                onClick={() => onEligibilityChange("ALL")}
                className="text-muted-foreground hover:text-foreground p-1"
                title="Clear eligibility filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── TECHNOLOGY CATEGORY CHIPS ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
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
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80 hover:text-foreground"
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
