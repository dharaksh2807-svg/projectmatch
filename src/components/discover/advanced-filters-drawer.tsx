"use client";

import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  RotateCcw,
  Search,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Code2,
  Trophy,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  TECH_TAXONOMY,
  STANDARD_SKILLS,
} from "@/lib/filters/normalize";

export interface AvailableHackathon {
  id: string;
  name: string;
  mode?: string | null;
  city?: string | null;
  status?: string | null;
  registrationStatus?: string | null;
}

export const HACKATHON_TRACKS = [
  "All",
  "AI & ML",
  "Web3",
  "FinTech",
  "Health & BioTech",
  "Education",
  "Open Source",
  "Social Good",
  "Cybersecurity",
  "Hardware & IoT",
];

export const DURATIONS = [
  "All",
  "< 1 week",
  "1-4 weeks",
  "1-3 months",
  "3-6 months",
  "6+ months",
];

export const COMMITMENT_OPTIONS = [
  { label: "All Commitments", value: "All" },
  { label: "Part-time (5-15h/wk)", value: "Part-time" },
  { label: "Full-time (30-40h/wk)", value: "Full-time" },
  { label: "Flexible", value: "Flexible" },
];

export const PARTICIPATION_MODES = [
  { label: "All Modes", value: "ALL" },
  { label: "Online / Virtual", value: "ONLINE" },
  { label: "In-Person / Offline", value: "OFFLINE" },
  { label: "Hybrid", value: "HYBRID" },
];

export const CAMPUS_OPTIONS = [
  { label: "All Campuses / Open", value: "ALL" },
  { label: "SRMIST (Kattankulathur)", value: "srm-ist" },
  { label: "IIT Madras", value: "iit-madras" },
  { label: "Anna University", value: "anna-univ" },
  { label: "VIT Chennai", value: "vit-chennai" },
];

interface AdvancedFiltersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeFiltersCount: number;
  onResetAll: () => void;

  // Technical Filters
  selectedTechs: string[];
  onToggleTech: (tech: string) => void;
  onClearTechs: () => void;
  techMode: "any" | "all";
  setTechMode: (mode: "any" | "all") => void;

  selectedSkills: string[];
  onToggleSkill: (skill: string) => void;
  onClearSkills: () => void;
  skillMode: "any" | "all";
  setSkillMode: (mode: "any" | "all") => void;

  availableTechs: string[];
  techCounts?: Record<string, number>;
  availableSkills: string[];

  // Hackathon Filters
  availableHackathons: AvailableHackathon[];
  selectedHackathonId: string;
  setSelectedHackathonId: (id: string) => void;
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  selectedTrack: string;
  setSelectedTrack: (track: string) => void;
  openRegOnly: boolean;
  setOpenRegOnly: (val: boolean) => void;
  selectedCollege: string;
  setSelectedCollege: (college: string) => void;

  // Team & Recruitment Filters
  selectedDuration: string;
  setSelectedDuration: (dur: string) => void;
  minSpots: number;
  setMinSpots: (spots: number) => void;
  selectedCommitment: string;
  setSelectedCommitment: (comm: string) => void;
  beginnerFriendly: boolean;
  setBeginnerFriendly: (val: boolean) => void;
  openOnly: boolean;
  setOpenOnly: (val: boolean) => void;
  hideApplied: boolean;
  setHideApplied: (val: boolean) => void;
  minScore: number;
  setMinScore: (score: number) => void;

  // User State
  isGuest: boolean;
}

export function AdvancedFiltersDrawer({
  isOpen,
  onClose,
  activeFiltersCount,
  onResetAll,
  selectedTechs,
  onToggleTech,
  onClearTechs,
  techMode,
  setTechMode,
  selectedSkills,
  onToggleSkill,
  onClearSkills,
  skillMode,
  setSkillMode,
  availableTechs,
  techCounts = {},
  availableSkills,
  availableHackathons,
  selectedHackathonId,
  setSelectedHackathonId,
  selectedMode,
  setSelectedMode,
  selectedTrack,
  setSelectedTrack,
  openRegOnly,
  setOpenRegOnly,
  selectedCollege,
  setSelectedCollege,
  selectedDuration,
  setSelectedDuration,
  minSpots,
  setMinSpots,
  selectedCommitment,
  setSelectedCommitment,
  beginnerFriendly,
  setBeginnerFriendly,
  openOnly,
  setOpenOnly,
  hideApplied,
  setHideApplied,
  minScore,
  setMinScore,
  isGuest,
}: AdvancedFiltersDrawerProps) {
  // Collapsible category accordions
  const [techSectionOpen, setTechSectionOpen] = useState(true);
  const [hackathonSectionOpen, setHackathonSectionOpen] = useState(true);
  const [teamSectionOpen, setTeamSectionOpen] = useState(true);
  const [compatSectionOpen, setCompatSectionOpen] = useState(false);

  // Search filter for tech tags
  const [techSearch, setTechSearch] = useState("");
  const [selectedTechCategory, setSelectedTechCategory] = useState<string>("All");

  // Search filter for skills
  const [skillSearch, setSkillSearch] = useState("");

  // Filtered tech options
  const displayTechs = useMemo(() => {
    let pool: string[] = [];
    if (selectedTechCategory === "All") {
      pool = Array.from(new Set([...availableTechs, ...Object.values(TECH_TAXONOMY).flat()]));
    } else if (TECH_TAXONOMY[selectedTechCategory as keyof typeof TECH_TAXONOMY]) {
      pool = TECH_TAXONOMY[selectedTechCategory as keyof typeof TECH_TAXONOMY];
    } else {
      pool = availableTechs;
    }

    if (techSearch.trim()) {
      const q = techSearch.toLowerCase().trim();
      return pool.filter((t) => t.toLowerCase().includes(q));
    }
    return pool.slice(0, 40);
  }, [selectedTechCategory, availableTechs, techSearch]);

  // Filtered skill options
  const displaySkills = useMemo(() => {
    const pool = Array.from(new Set([...STANDARD_SKILLS, ...availableSkills]));
    if (skillSearch.trim()) {
      const q = skillSearch.toLowerCase().trim();
      return pool.filter((s) => s.toLowerCase().includes(q));
    }
    return pool;
  }, [availableSkills, skillSearch]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col h-full bg-card border-l border-border"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-4 sm:p-5 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>Discovery Filters</span>
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="text-[10px] h-5 px-1.5 font-bold">
                  {activeFiltersCount} active
                </Badge>
              )}
            </SheetTitle>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetAll}
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </Button>
            )}
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Filter roles across hackathon requirements, technical stack, team goals, and recruitment criteria.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Filter Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* ─────────────────────────────────────────────────────────────
              SECTION A: TECHNICAL FILTERS (TECH STACK & SKILLS)
              ───────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setTechSectionOpen(!techSectionOpen)}
              className="w-full px-4 py-3 flex items-center justify-between text-left font-semibold text-xs text-foreground bg-secondary/40 hover:bg-secondary/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                <span>Technical Stack & Skills</span>
                {(selectedTechs.length > 0 || selectedSkills.length > 0) && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {selectedTechs.length + selectedSkills.length}
                  </Badge>
                )}
              </span>
              {techSectionOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {techSectionOpen && (
              <div className="p-4 space-y-5">
                {/* 1. Technologies Multi-Select */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                        <span>Technologies</span>
                        <span className="text-muted-foreground font-normal">
                          ({selectedTechs.length} selected)
                        </span>
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-normal">
                          Synced with main page
                        </span>
                      </label>
                      {selectedTechs.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearTechs}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 border border-border">
                      <button
                        type="button"
                        onClick={() => setTechMode("any")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] rounded font-medium transition-colors",
                          techMode === "any"
                            ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Match projects having ANY of the selected technologies"
                      >
                        Match Any
                      </button>
                      <button
                        type="button"
                        onClick={() => setTechMode("all")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] rounded font-medium transition-colors",
                          techMode === "all"
                            ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Match projects strictly having ALL selected technologies"
                      >
                        Match All
                      </button>
                    </div>
                  </div>

                  {/* Tech Search & Category Select */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        value={techSearch}
                        onChange={(e) => setTechSearch(e.target.value)}
                        placeholder="Search frameworks, languages, databases..."
                        className="pl-8 h-8 text-xs rounded-lg"
                      />
                      {techSearch && (
                        <button
                          type="button"
                          onClick={() => setTechSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                      {["All", ...Object.keys(TECH_TAXONOMY)].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedTechCategory(cat)}
                          className={cn(
                            "px-2 py-0.5 rounded-md shrink-0 border transition-colors",
                            selectedTechCategory === cat
                              ? "bg-secondary text-foreground font-semibold border-border-strong"
                              : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/40"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tech Tags Cloud */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-border rounded-xl bg-card">
                    {displayTechs.map((tech) => {
                      const isSelected = selectedTechs.some((t) => t.toLowerCase() === tech.toLowerCase());
                      const count = techCounts[tech] || 0;
                      return (
                        <button
                          key={tech}
                          type="button"
                          onClick={() => onToggleTech(tech)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium flex items-center gap-1",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{tech}</span>
                          {count > 0 && (
                            <span
                              className={cn(
                                "text-[10px] px-1 py-0.5 rounded-md font-mono",
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Skills Multi-Select */}
                <div className="space-y-2.5 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span>Skills & Disciplines</span>
                        <span className="text-muted-foreground font-normal">
                          ({selectedSkills.length} selected)
                        </span>
                      </label>
                      {selectedSkills.length > 0 && (
                        <button
                          type="button"
                          onClick={onClearSkills}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5 border border-border">
                      <button
                        type="button"
                        onClick={() => setSkillMode("any")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] rounded font-medium transition-colors",
                          skillMode === "any"
                            ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Match roles requiring ANY of the selected skills"
                      >
                        Match Any
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkillMode("all")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] rounded font-medium transition-colors",
                          skillMode === "all"
                            ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Match roles requiring ALL selected skills"
                      >
                        Match All
                      </button>
                    </div>
                  </div>

                  {/* Skill Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                      placeholder="Search skills (e.g. Frontend, Machine Learning)..."
                      className="pl-8 h-8 text-xs rounded-lg"
                    />
                    {skillSearch && (
                      <button
                        type="button"
                        onClick={() => setSkillSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Skills Cloud */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-border rounded-xl bg-card">
                    {displaySkills.map((skill) => {
                      const isSelected = selectedSkills.some((s) => s.toLowerCase() === skill.toLowerCase());
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => onToggleSkill(skill)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-lg border transition-all font-medium flex items-center gap-1",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{skill}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION B: HACKATHON & EVENT FILTERS
              ───────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setHackathonSectionOpen(!hackathonSectionOpen)}
              className="w-full px-4 py-3 flex items-center justify-between text-left font-semibold text-xs text-foreground bg-secondary/40 hover:bg-secondary/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <span>Hackathon & Event Filters</span>
                {(selectedHackathonId !== "All" ||
                  selectedMode !== "ALL" ||
                  selectedTrack !== "All" ||
                  openRegOnly ||
                  selectedCollege !== "ALL") && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    Active
                  </Badge>
                )}
              </span>
              {hackathonSectionOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {hackathonSectionOpen && (
              <div className="p-4 space-y-4">
                {/* Specific Hackathon Dropdown */}
                {availableHackathons.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Associated Hackathon Event
                    </label>
                    <select
                      value={selectedHackathonId}
                      onChange={(e) => setSelectedHackathonId(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="All">All Hackathons / Independent Projects</option>
                      {availableHackathons.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} {h.city ? `(${h.city})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Participation Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Participation Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PARTICIPATION_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setSelectedMode(mode.value)}
                        className={cn(
                          "px-3 py-2 text-xs rounded-xl border font-medium text-left transition-colors flex items-center justify-between",
                          selectedMode === mode.value
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                        )}
                      >
                        <span>{mode.label}</span>
                        {selectedMode === mode.value && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hackathon Domain / Track */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Domain / Track
                  </label>
                  <select
                    value={selectedTrack}
                    onChange={(e) => setSelectedTrack(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {HACKATHON_TRACKS.map((track) => (
                      <option key={track} value={track}>
                        {track === "All" ? "All Domains & Tracks" : track}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campus / Eligibility Scope */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Campus / Host College
                  </label>
                  <select
                    value={selectedCollege}
                    onChange={(e) => setSelectedCollege(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {CAMPUS_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Open Registration Only (Strict DB Verification) */}
                <label className="flex items-center justify-between text-xs cursor-pointer p-2.5 rounded-xl border border-border hover:bg-secondary transition-colors">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      Open Registration Only
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Shows only verified events where registration is officially open
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={openRegOnly}
                    onChange={(e) => setOpenRegOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-input focus:ring-primary shrink-0 ml-2"
                  />
                </label>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION C: TEAM & RECRUITMENT FILTERS
              ───────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setTeamSectionOpen(!teamSectionOpen)}
              className="w-full px-4 py-3 flex items-center justify-between text-left font-semibold text-xs text-foreground bg-secondary/40 hover:bg-secondary/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Team & Recruitment Criteria</span>
                {(selectedDuration !== "All" ||
                  minSpots > 0 ||
                  selectedCommitment !== "All" ||
                  beginnerFriendly ||
                  openOnly) && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    Active
                  </Badge>
                )}
              </span>
              {teamSectionOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {teamSectionOpen && (
              <div className="p-4 space-y-4">
                {/* Project Duration */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Project Duration
                  </label>
                  <select
                    value={selectedDuration}
                    onChange={(e) => setSelectedDuration(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {DURATIONS.map((dur) => (
                      <option key={dur} value={dur}>
                        {dur === "All" ? "All Durations" : dur}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Minimum Open Spots */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Open Vacancies
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Any", value: 0 },
                      { label: "1+", value: 1 },
                      { label: "2+", value: 2 },
                      { label: "3+", value: 3 },
                    ].map((spot) => (
                      <button
                        key={spot.value}
                        type="button"
                        onClick={() => setMinSpots(spot.value)}
                        className={cn(
                          "py-1.5 text-xs rounded-xl border font-medium transition-colors text-center",
                          minSpots === spot.value
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                        )}
                      >
                        {spot.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Commitment */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Time Commitment
                  </label>
                  <select
                    value={selectedCommitment}
                    onChange={(e) => setSelectedCommitment(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-input bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {COMMITMENT_OPTIONS.map((comm) => (
                      <option key={comm.value} value={comm.value}>
                        {comm.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Beginner Friendly Toggle */}
                <label className="flex items-center justify-between text-xs cursor-pointer p-2.5 rounded-xl border border-border hover:bg-secondary transition-colors">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      Beginner-Friendly Teams
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Highlights teams welcoming first-time hackathon builders
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={beginnerFriendly}
                    onChange={(e) => setBeginnerFriendly(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-input focus:ring-primary shrink-0 ml-2"
                  />
                </label>

                {/* Spots Available Only */}
                <label className="flex items-center justify-between text-xs cursor-pointer p-2.5 rounded-xl border border-border hover:bg-secondary transition-colors">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      Hide Filled Positions
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Only displays roles with at least 1 open vacancy
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={openOnly}
                    onChange={(e) => setOpenOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-input focus:ring-primary shrink-0 ml-2"
                  />
                </label>

                {/* Hide Already Applied */}
                {!isGuest && (
                  <label className="flex items-center justify-between text-xs cursor-pointer p-2.5 rounded-xl border border-border hover:bg-secondary transition-colors">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground block">
                        Hide Applied Roles
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Exclude positions where you have an active application
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={hideApplied}
                      onChange={(e) => setHideApplied(e.target.checked)}
                      className="w-4 h-4 rounded text-primary border-input focus:ring-primary shrink-0 ml-2"
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION D: ADVANCED COMPATIBILITY & SCORING
              ───────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setCompatSectionOpen(!compatSectionOpen)}
              className="w-full px-4 py-3 flex items-center justify-between text-left font-semibold text-xs text-foreground bg-secondary/40 hover:bg-secondary/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Compatibility & Match Threshold</span>
                {minScore > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    ≥ {minScore}%
                  </Badge>
                )}
              </span>
              {compatSectionOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {compatSectionOpen && (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">
                      Minimum Match Score
                    </span>
                    <span className="font-bold text-primary">
                      {minScore > 0 ? `${minScore}%` : "No minimum"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={10}
                    value={minScore}
                    onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Any (0%)</span>
                    <span>50%</span>
                    <span>High (90%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Sticky Footer */}
        <SheetFooter className="p-4 border-t border-border bg-card flex flex-row items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear All
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="font-semibold shadow-xs px-5"
          >
            Apply Filters ({activeFiltersCount})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
