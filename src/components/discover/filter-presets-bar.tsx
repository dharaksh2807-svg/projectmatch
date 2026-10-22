"use client";

import { Button } from "@/components/ui/button";
import {
  Users,
  Sparkles,
  Cpu,
  Globe,
  Share2,
  LucideIcon,
  Check,
} from "lucide-react";
import {
  BUILT_IN_PRESETS,
  FilterPreset,
  SavedSearchFilters,
} from "@/lib/filters/saved-searches";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Users,
  Sparkles,
  Cpu,
  Globe,
};

interface FilterPresetsBarProps {
  currentFilters: Partial<SavedSearchFilters>;
  savedSearchesCount?: number;
  onApplyPreset: (preset: FilterPreset) => void;
  onOpenSaveModal?: () => void;
  onOpenSavedSearches?: () => void;
  onCopyShareLink?: () => void;
  isGuest?: boolean;
}

export function FilterPresetsBar({
  currentFilters,
  onApplyPreset,
  onCopyShareLink,
}: FilterPresetsBarProps) {
  // Check if a preset is actively matching current filters
  const isPresetActive = (preset: FilterPreset): boolean => {
    const f = preset.filters;
    if (f.openOnly !== undefined && currentFilters.openOnly !== f.openOnly) return false;
    if (f.minSpots !== undefined && (currentFilters.minSpots || 0) < f.minSpots) return false;
    if (f.beginnerFriendly !== undefined && currentFilters.beginnerFriendly !== f.beginnerFriendly) return false;
    if (f.exp !== undefined && currentFilters.exp !== f.exp) return false;
    if (f.role !== undefined && currentFilters.role !== f.role) return false;
    if (f.type !== undefined && currentFilters.type !== f.type) return false;
    if (f.mode !== undefined && currentFilters.mode !== f.mode) return false;
    if (f.tech && f.tech.length > 0) {
      if (!currentFilters.tech || !f.tech.every((t) => currentFilters.tech?.includes(t))) {
        return false;
      }
    }
    return true;
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 py-0.5 text-xs">
      {/* Presets Row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground mr-1 select-none">
          Presets:
        </span>

        {BUILT_IN_PRESETS.map((preset) => {
          const Icon = ICONS[preset.iconName] || Sparkles;
          const active = isPresetActive(preset);

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                  : "bg-card hover:bg-secondary text-muted-foreground hover:text-foreground border-border"
              )}
              title={preset.description}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span>{preset.name}</span>
              {active && <Check className="w-3 h-3 ml-0.5 stroke-[2.5]" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* Contextual Share Action */}
      {onCopyShareLink && (
        <div className="flex items-center ml-auto self-end sm:self-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCopyShareLink}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg border border-transparent hover:border-border hover:bg-secondary transition-colors"
            title="Copy clean shareable link with current active filters"
            aria-label="Share current search filters"
          >
            <Share2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span className="font-medium">Share</span>
          </Button>
        </div>
      )}
    </div>
  );
}
