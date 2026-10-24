"use client";

import { useState, useMemo } from "react";
import {
  Code2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { tagMatches, ALL_PREDEFINED_TECHS } from "@/lib/filters/normalize";
import { resolveTechCategory } from "@/lib/filters/tech-catalog";

const DEFAULT_POPULAR = [
  "React",
  "Next.js",
  "Python",
  "TypeScript",
  "Node.js",
  "PostgreSQL",
  "FastAPI",
  "Tailwind CSS",
  "Docker",
  "Java",
  "PyTorch",
  "Go",
];

export interface DiscoverTechFilterProps {
  selectedTechs: string[];
  techMode: "any" | "all";
  onToggleTech: (tech: string) => void;
  onClearTechs: () => void;
  onSetTechMode: (mode: "any" | "all") => void;
  availableTechs: string[];
  techCounts?: Record<string, number>;
  popularTechs?: string[];
  categories?: Record<string, string[]>;
  className?: string;
}

export function DiscoverTechFilter({
  selectedTechs,
  techMode,
  onToggleTech,
  onClearTechs,
  onSetTechMode,
  availableTechs = [],
  techCounts = {},
  popularTechs = [],
  categories = {},
  className,
}: DiscoverTechFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Reliable list of all techs with fallback
  const effectiveAvailableTechs = useMemo(() => {
    if (availableTechs && availableTechs.length > 0) {
      return availableTechs;
    }
    return ALL_PREDEFINED_TECHS;
  }, [availableTechs]);

  // Determine popular technologies list (fallback if empty)
  const popularList = useMemo(() => {
    if (popularTechs && popularTechs.length > 0) {
      return popularTechs;
    }
    if (availableTechs && availableTechs.length > 0) {
      return availableTechs.slice(0, 10);
    }
    return DEFAULT_POPULAR;
  }, [popularTechs, availableTechs]);

  // Available categories list
  const categoryNames = useMemo(() => {
    const defaultOrder = [
      "All",
      "Frontend",
      "Backend",
      "Languages",
      "Databases",
      "AI / ML",
      "Cloud / DevOps",
      "Mobile",
      "Web3",
      "Hardware / IoT",
      "Other",
    ];
    // Keep categories that have items in categories object or default ones
    const presentCats = new Set(Object.keys(categories));
    return defaultOrder.filter((cat) => cat === "All" || presentCats.has(cat));
  }, [categories]);

  // Filtered technologies based on search query and category
  const filteredTechs = useMemo(() => {
    let pool = effectiveAvailableTechs;

    if (activeCategory !== "All") {
      if (categories[activeCategory]) {
        pool = categories[activeCategory];
      } else {
        pool = pool.filter((t) => resolveTechCategory(t) === activeCategory);
      }
    }

    if (!searchQuery.trim()) {
      return pool;
    }

    const q = searchQuery.toLowerCase().trim();
    return pool.filter((t) => {
      // Direct substring match
      if (t.toLowerCase().includes(q)) return true;
      // Alias or fuzzy normalized match
      return tagMatches(t, q) || tagMatches(q, t);
    });
  }, [effectiveAvailableTechs, activeCategory, categories, searchQuery]);

  // Helper to check if a tech is currently selected
  const isSelected = (tech: string) => {
    return selectedTechs.some((t) => t.toLowerCase() === tech.toLowerCase());
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 sm:p-3.5 space-y-2.5",
        className
      )}
    >
      {/* ── 1. HEADER ROW: Title, Badges, Match Toggle & Clear ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Code2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">
            Technology Stack
          </h2>
          {selectedTechs.length > 0 && (
            <Badge variant="secondary" className="text-[11px] h-5 px-1.5 font-medium">
              {selectedTechs.length} selected
            </Badge>
          )}
          {selectedTechs.length > 0 && (
            <button
              type="button"
              onClick={onClearTechs}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-0.5 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              title="Clear selected technologies"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Match ANY vs Match ALL Segmented Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-muted-foreground font-medium hidden xs:inline select-none">
            Rule:
          </span>
          <div
            role="group"
            aria-label="Technology match mode"
            className="inline-flex items-center bg-input-bg rounded-lg p-0.5 border border-border"
          >
            <button
              type="button"
              onClick={() => onSetTechMode("any")}
              aria-pressed={techMode === "any"}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                techMode === "any"
                  ? "bg-primary/20 text-primary font-semibold border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
              title="Projects matching ANY selected technology will be shown"
            >
              Match ANY
            </button>
            <button
              type="button"
              onClick={() => onSetTechMode("all")}
              aria-pressed={techMode === "all"}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                techMode === "all"
                  ? "bg-primary/20 text-primary font-semibold border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
              title="Projects strictly matching ALL selected technologies will be shown"
            >
              Match ALL
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. SEARCH INPUT ── */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim() && !isExpanded) {
              setIsExpanded(true);
            }
          }}
          placeholder="Filter technology list (e.g. React, Python, PostgreSQL, Docker)..."
          className="pl-8.5 pr-8 h-8.5 text-xs rounded-lg bg-input-bg border-input focus-visible:ring-primary shadow-none"
          aria-label="Search technologies"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear technology search"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── 3. POPULAR TECHNOLOGIES (ALWAYS VISIBLE COMPACT ROW) ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5">
            <span>Popular Technologies</span>
          </span>
          <span className="text-[11px] text-muted-foreground/80 font-normal">
            {effectiveAvailableTechs.length} total technologies
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {popularList.map((tech) => {
            const active = isSelected(tech);
            const count = techCounts[tech] || 0;
            return (
              <button
                key={tech}
                type="button"
                onClick={() => onToggleTech(tech)}
                aria-pressed={active}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium flex items-center gap-1.5 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "bg-primary/15 text-primary border-primary/35 font-medium"
                    : "bg-secondary/40 text-foreground border-border/80 hover:bg-secondary hover:border-border-strong"
                )}
              >
                {active && (
                  <Check className="w-3 h-3 text-primary shrink-0 stroke-[2.5]" aria-hidden="true" />
                )}
                <span>{tech}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1 py-0.2 rounded font-mono",
                      active
                        ? "bg-primary/20 text-primary"
                        : "bg-background text-muted-foreground border border-border/60"
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

      {/* ── 4. ACTIVE SELECTED CHIPS STRIP (WHEN ANY ARE SELECTED) ── */}
      {selectedTechs.length > 0 && (
        <div className="pt-2 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium mr-1 select-none">
              Selected:
            </span>
            {selectedTechs.map((tech) => (
              <Badge
                key={tech}
                variant="accent"
                className="gap-1 pr-1 pl-2 py-0.5 text-xs font-medium border-border"
              >
                <span>{tech}</span>
                <button
                  type="button"
                  onClick={() => onToggleTech(tech)}
                  className="hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                  aria-label={`Remove ${tech} filter`}
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
            <span className="text-[11px] text-muted-foreground ml-1">
              ({techMode === "all" ? "Projects must match ALL" : "Projects match ANY"})
            </span>
          </div>
        </div>
      )}

      {/* ── 5. EXPAND / COLLAPSE BUTTON ── */}
      <div className="pt-1 flex items-center justify-between border-t border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="h-7 text-xs text-foreground/80 hover:text-foreground hover:bg-secondary gap-1.5 px-2 rounded-lg font-medium"
        >
          <Layers className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>
            {isExpanded
              ? "Collapse Catalog"
              : `Show All Technologies (${effectiveAvailableTechs.length})`}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
          )}
        </Button>

        {isExpanded && (
          <span className="text-[11px] text-muted-foreground">
            {filteredTechs.length} shown
          </span>
        )}
      </div>

      {/* ── 6. EXPANDED FULL CATALOG VIEW ── */}
      {isExpanded && (
        <div className="space-y-2 pt-1 animate-in fade-in-50 duration-200">
          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categoryNames.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg shrink-0 border text-xs transition-colors font-medium",
                  activeCategory === cat
                    ? "bg-secondary text-foreground font-semibold border-border-strong shadow-2xs"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Categorized Tech Chips Cloud (Bounded scroll region) */}
          <div className="max-h-52 sm:max-h-60 overflow-y-auto p-2.5 border border-border/80 rounded-xl bg-background/50 space-y-2">
            {filteredTechs.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
                <p>No technologies found matching &quot;{searchQuery}&quot;</p>
                <p className="text-[11px]">
                  Try searching for a different language, framework, database, or tool.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filteredTechs.map((tech) => {
                  const active = isSelected(tech);
                  const count = techCounts[tech] || 0;
                  return (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => onToggleTech(tech)}
                      aria-pressed={active}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium flex items-center gap-1.5 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        active
                          ? "bg-primary/15 text-primary border-primary/35 font-medium"
                          : "bg-secondary/40 text-foreground border-border/80 hover:bg-secondary hover:border-border-strong"
                      )}
                    >
                      {active && (
                        <Check className="w-3 h-3 text-primary shrink-0 stroke-[2.5]" aria-hidden="true" />
                      )}
                      <span>{tech}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "text-[10px] px-1 py-0.2 rounded font-mono",
                            active
                              ? "bg-primary/20 text-primary"
                              : "bg-background text-muted-foreground border border-border/60"
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
