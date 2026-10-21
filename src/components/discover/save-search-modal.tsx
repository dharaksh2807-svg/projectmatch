"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bookmark,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import {
  SavedSearchFilters,
  buildFilterSummary,
} from "@/lib/filters/saved-searches";

interface SaveSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeFilters: Partial<SavedSearchFilters>;
  context?: "ROLES" | "HACKATHONS";
  availableHackathons?: { id: string; name: string }[];
  onSearchSaved?: (savedSearch: any) => void;
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
}

export function SaveSearchModal({
  open,
  onOpenChange,
  activeFilters,
  context = "ROLES",
  availableHackathons = [],
  onSearchSaved,
  onShowToast,
}: SaveSearchModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute filter summary chips
  const filterSummary = buildFilterSummary(activeFilters, {
    availableHackathons,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setErrorMessage("Please enter a name for your saved search.");
      return;
    }

    if (trimmed.length > 60) {
      setErrorMessage("Search name must be 60 characters or fewer.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          context,
          filters: activeFilters,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to save search. Please try again.");
        return;
      }

      onShowToast(`Saved search "${trimmed}" created!`, "success");
      if (onSearchSaved) {
        onSearchSaved(data.savedSearch);
      }
      setName("");
      onOpenChange(false);
    } catch (err) {
      console.error("Save search error:", err);
      setErrorMessage("Network error while saving search. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Save Current Search
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Name and bookmark this filter combination for instant 1-click access.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          {/* Search Name Input */}
          <div className="space-y-1.5">
            <Label htmlFor="search-name" className="text-xs font-semibold text-foreground">
              Search Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="search-name"
              placeholder="e.g. AI Hackathon Teams, Remote Python, Frontend Leads"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              maxLength={60}
              className="text-sm h-10 rounded-xl"
              autoFocus
              required
            />
            <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
              <span>Give it a concise, memorable label</span>
              <span>{name.length}/60</span>
            </div>
          </div>

          {/* Active Filters Preview */}
          <div className="space-y-2 rounded-xl bg-muted/40 p-3 border border-border/60">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-primary" />
                Included Filters ({filterSummary.length})
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">
                Context: {context === "ROLES" ? "Discover Opportunities" : "Hackathons"}
              </span>
            </div>

            {filterSummary.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                No active filters selected (saves general discovery view).
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {filterSummary.map((item) => (
                  <Badge
                    key={item.key}
                    variant="secondary"
                    className="text-[11px] font-medium px-2 py-0.5 bg-background border border-border/80 text-foreground flex items-center gap-1"
                  >
                    <span className="text-muted-foreground font-normal">
                      {item.category}:
                    </span>
                    <span>{item.label}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row items-center gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !name.trim()}
              className="w-full sm:w-auto h-9 text-xs gap-1.5 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save Search
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
