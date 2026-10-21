"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Badge } from "@/components/ui/badge";
import {
  Bookmark,
  Play,
  Share2,
  Edit2,
  Copy,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import {
  SavedSearchFilters,
  buildFilterSummary,
  generateShareableSearchUrl,
  detectUnavailableFilters,
  BUILT_IN_PRESETS,
  FilterPreset,
} from "@/lib/filters/saved-searches";

export interface SavedSearchRecord {
  id: string;
  userId: string;
  name: string;
  context: "ROLES" | "HACKATHONS";
  version: number;
  filters: SavedSearchFilters;
  createdAt: string;
  updatedAt: string;
}

interface SavedSearchesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: Partial<SavedSearchFilters>;
  context?: "ROLES" | "HACKATHONS";
  availableHackathons?: { id: string; name: string }[];
  availableTechs?: string[];
  availableSkills?: string[];
  onApplySavedSearch: (filters: SavedSearchFilters, searchName: string) => void;
  onApplyPreset?: (preset: FilterPreset) => void;
  onShowToast: (message: string, type: "success" | "error" | "info") => void;
  onOpenSaveModal: () => void;
}

export function SavedSearchesDrawer({
  open,
  onOpenChange,
  currentFilters,
  context = "ROLES",
  availableHackathons = [],
  availableTechs = [],
  availableSkills = [],
  onApplySavedSearch,
  onApplyPreset,
  onShowToast,
  onOpenSaveModal,
}: SavedSearchesDrawerProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Rename state
  const [renamingSearch, setRenamingSearch] = useState<SavedSearchRecord | null>(null);
  const [newName, setNewName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  // Delete confirmation state
  const [deletingSearch, setDeletingSearch] = useState<SavedSearchRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copied link indicator per item
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch saved searches from server
  const fetchSearches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/saved-searches?context=${context}`);
      if (res.ok) {
        const data = await res.json();
        setSavedSearches(data.savedSearches || []);
      }
    } catch (err) {
      console.error("Failed to load saved searches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSearches();
    }
  }, [open, context]);

  // Handle Run Search
  const handleRunSearch = (record: SavedSearchRecord) => {
    onApplySavedSearch(record.filters, record.name);
    onOpenChange(false);
    onShowToast(`Applied saved search "${record.name}"`, "info");
  };

  // Handle Share Link (URL copy)
  const handleCopyLink = async (record: SavedSearchRecord) => {
    try {
      const relativePath = generateShareableSearchUrl(record.filters, "/discover");
      const fullUrl = `${window.location.origin}${relativePath}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2500);
      onShowToast("Search link copied to clipboard! Share it with anyone.", "success");
    } catch (err) {
      console.error("Failed to copy search link:", err);
      onShowToast("Failed to copy link to clipboard.", "error");
    }
  };

  // Handle Update with Current Filters
  const handleUpdateWithCurrentFilters = async (record: SavedSearchRecord) => {
    setActionInProgressId(record.id);
    try {
      const res = await fetch(`/api/saved-searches/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: currentFilters,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update saved search");
      }

      const data = await res.json();
      setSavedSearches((prev) =>
        prev.map((s) => (s.id === record.id ? data.savedSearch : s))
      );
      onShowToast(`Updated "${record.name}" with current filters!`, "success");
    } catch (err: any) {
      console.error("Update saved search error:", err);
      onShowToast(err.message || "Failed to update filters", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Duplicate
  const handleDuplicate = async (record: SavedSearchRecord) => {
    setActionInProgressId(record.id);
    try {
      const duplicateName = `Copy of ${record.name}`.slice(0, 60);
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: duplicateName,
          context: record.context,
          filters: record.filters,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to duplicate search");
      }

      const data = await res.json();
      setSavedSearches((prev) => [data.savedSearch, ...prev]);
      onShowToast(`Duplicated as "${data.savedSearch.name}"`, "success");
    } catch (err: any) {
      console.error("Duplicate search error:", err);
      onShowToast(err.message || "Failed to duplicate search", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Rename Submit
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingSearch) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      onShowToast("Name cannot be empty.", "error");
      return;
    }

    setRenameLoading(true);
    try {
      const res = await fetch(`/api/saved-searches/${renamingSearch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename search");
      }

      const data = await res.json();
      setSavedSearches((prev) =>
        prev.map((s) => (s.id === renamingSearch.id ? data.savedSearch : s))
      );
      onShowToast(`Renamed to "${trimmed}"`, "success");
      setRenamingSearch(null);
    } catch (err: any) {
      console.error("Rename error:", err);
      onShowToast(err.message || "Failed to rename search", "error");
    } finally {
      setRenameLoading(false);
    }
  };

  // Handle Delete Submit
  const handleDeleteSubmit = async () => {
    if (!deletingSearch) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/saved-searches/${deletingSearch.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete saved search");
      }

      setSavedSearches((prev) => prev.filter((s) => s.id !== deletingSearch.id));
      onShowToast(`Deleted "${deletingSearch.name}"`, "info");
      setDeletingSearch(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      onShowToast(err.message || "Failed to delete search", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 flex flex-col bg-card border-l border-border shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="p-5 pb-4 border-b border-border bg-card sticky top-0 z-10 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-foreground">
                    Saved Searches
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Manage and run your saved filter combinations
                  </SheetDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs px-2 py-0.5 font-semibold">
                {savedSearches.length} / 25
              </Badge>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenSaveModal}
                className="w-full h-8 text-xs font-semibold gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/5"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save Current Active Filters
              </Button>
            </div>
          </SheetHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs">Loading saved searches...</p>
              </div>
            ) : savedSearches.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/80 shadow-xs">
                  <Bookmark className="w-7 h-7 stroke-[1.5]" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h3 className="text-sm font-semibold text-foreground">
                    No Saved Searches Yet
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Set up your preferred discovery filters on the main page, then click &ldquo;Save Search&rdquo; to store them for quick 1-click access.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={onOpenSaveModal}
                  className="text-xs font-semibold h-8 gap-1.5 shadow-xs"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  Save Current Search
                </Button>

                {/* Built-in Presets suggestion */}
                <div className="w-full pt-4 border-t border-border/60 text-left space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Or explore popular presets
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {BUILT_IN_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          if (onApplyPreset) onApplyPreset(preset);
                          onOpenChange(false);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-background hover:bg-secondary/40 text-left transition-colors group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {preset.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {preset.description}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0 font-medium"
                        >
                          {preset.badge}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Saved Searches List */
              <div className="space-y-3">
                {savedSearches.map((record) => {
                  const summary = buildFilterSummary(record.filters, {
                    availableHackathons,
                    availableTechs,
                    availableSkills,
                  });
                  const availability = detectUnavailableFilters(record.filters, {
                    availableHackathons,
                    availableTechs,
                    availableSkills,
                  });
                  const isBusy = actionInProgressId === record.id;

                  return (
                    <div
                      key={record.id}
                      className="p-3.5 rounded-xl border border-border bg-background hover:border-primary/40 transition-all shadow-2xs space-y-2.5"
                    >
                      {/* Title & Context */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-foreground tracking-tight">
                            {record.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground/70" />
                              Updated {formatDate(record.updatedAt)}
                            </span>
                            <span>•</span>
                            <span className="font-medium">
                              {record.context === "ROLES"
                                ? "Discover Roles"
                                : "Hackathons"}
                            </span>
                          </div>
                        </div>

                        {/* Top Action Pills */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRenamingSearch(record);
                              setNewName(record.name);
                            }}
                            className="w-7 h-7 text-muted-foreground hover:text-foreground"
                            title="Rename"
                            aria-label={`Rename ${record.name}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicate(record)}
                            disabled={isBusy}
                            className="w-7 h-7 text-muted-foreground hover:text-foreground"
                            title="Duplicate"
                            aria-label={`Duplicate ${record.name}`}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingSearch(record)}
                            className="w-7 h-7 text-muted-foreground hover:text-destructive"
                            title="Delete"
                            aria-label={`Delete ${record.name}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Stale Filter Warning Notice */}
                      {availability.hasUnavailable && (
                        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] leading-tight">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <div className="space-y-0.5">
                            {availability.warnings.map((w, idx) => (
                              <p key={idx}>{w}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filter Chips Preview */}
                      <div className="flex flex-wrap gap-1">
                        {summary.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground italic">
                            All default opportunities (no specific filters)
                          </span>
                        ) : (
                          summary.map((item) => (
                            <Badge
                              key={item.key}
                              variant="secondary"
                              className="text-[10px] font-normal px-1.5 py-0.5 bg-muted text-foreground flex items-center gap-1 border border-border/60"
                            >
                              <span className="text-muted-foreground">
                                {item.category}:
                              </span>
                              <span className="font-semibold">{item.label}</span>
                            </Badge>
                          ))
                        )}
                      </div>

                      {/* Bottom Action Buttons */}
                      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(record)}
                            className="h-7 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground"
                            title="Copy clean shareable link to this search"
                          >
                            {copiedId === record.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Copied
                                </span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3 h-3" />
                                <span>Share</span>
                              </>
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateWithCurrentFilters(record)}
                            disabled={isBusy}
                            className="h-7 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground"
                            title="Overwrite this search with current page filters"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${isBusy ? "animate-spin" : ""}`}
                            />
                            <span>Sync Filters</span>
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleRunSearch(record)}
                          className="h-7 text-[11px] px-3 gap-1 font-semibold"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Run Search</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Rename Dialog */}
      {renamingSearch && (
        <Dialog open={!!renamingSearch} onOpenChange={(open) => !open && setRenamingSearch(null)}>
          <DialogContent className="sm:max-w-xs p-5 rounded-2xl bg-card border border-border shadow-xl">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-bold text-foreground">
                Rename Saved Search
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter a new name for &ldquo;{renamingSearch.name}&rdquo;.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleRenameSubmit} className="space-y-4 pt-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                className="text-xs h-9 rounded-lg"
                autoFocus
              />

              <DialogFooter className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRenamingSearch(null)}
                  disabled={renameLoading}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={renameLoading || !newName.trim()}
                  className="h-8 text-xs font-semibold"
                >
                  {renameLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingSearch && (
        <Dialog open={!!deletingSearch} onOpenChange={(open) => !open && setDeletingSearch(null)}>
          <DialogContent className="sm:max-w-xs p-5 rounded-2xl bg-card border border-border shadow-xl">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-bold text-destructive flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                Delete Saved Search?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Are you sure you want to remove &ldquo;{deletingSearch.name}&rdquo;? This cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingSearch(null)}
                disabled={deleteLoading}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteSubmit}
                disabled={deleteLoading}
                className="h-8 text-xs font-semibold"
              >
                {deleteLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
