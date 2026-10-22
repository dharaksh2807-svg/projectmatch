"use client";

import { Button } from "@/components/ui/button";
import {
  Users,
  Sparkles,
  Cpu,
  Globe,
  Bookmark,
  Share2,
  FolderHeart,
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
  onOpenSaveModal: () => void;
  onOpenSavedSearches: () => void;
  onCopyShareLink?: () => void;
  isGuest?: boolean;
}

export function FilterPresetsBar({
  currentFilters,
  savedSearchesCount = 0,
  onApplyPreset,
  onOpenSaveModal,
  onOpenSavedSearches,
  onCopyShareLink,
  isGuest = false,
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 py-1 text-xs">
      {/* Presets Row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary" />
          Presets:
        </span>

        {BUILT_IN_PRESETS.map((preset) => {
          const Icon = ICONS[preset.iconName] || Sparkles;
          const active = isPresetActive(preset);

          return (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-background hover:bg-secondary/70 text-muted-foreground hover:text-foreground border-border/80"
              )}
              title={preset.description}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span>{preset.name}</span>
              {active && <Check className="w-2.5 h-2.5 ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Saved Search Actions */}
      <div className="flex items-center gap-2 ml-auto self-end sm:self-auto">
        {!isGuest && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSaveModal}
              className="h-8 px-2.5 text-xs font-medium gap-1.5 rounded-lg border-border/80 hover:border-primary/50 text-foreground"
              title="Save current filters as a named preset"
            >
              <Bookmark className="w-3.5 h-3.5 text-primary" />
              <span>Save Search</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSavedSearches}
              className="h-8 px-2.5 text-xs font-medium gap-1.5 rounded-lg border-border/80 hover:border-primary/50 text-foreground"
              title="Open my saved searches"
            >
              <FolderHeart className="w-3.5 h-3.5 text-primary" />
              <span>Saved Searches</span>
              {savedSearchesCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                  {savedSearchesCount}
                </span>
              )}
            </Button>
          </>
        )}

        {onCopyShareLink && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopyShareLink}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 rounded-lg"
            title="Copy clean shareable link with current active filters"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Share</span>
          </Button>
        )}
      </div>
    </div>
  );
}
