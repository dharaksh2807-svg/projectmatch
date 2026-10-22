"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Star,
  Check,
  Eye,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Info,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FEEDBACK_DIMENSIONS, FeedbackDimension } from "@/lib/reputation/types";

interface ReviewModalProps {
  revieweeId: string;
  revieweeName: string;
  projects: { id: string; title: string }[];
  skills: string[];
}

export function ReviewModal({ revieweeId, revieweeName, projects, skills }: ReviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "");
  const [dimensions, setDimensions] = useState<Record<FeedbackDimension, number | null>>({
    communication: 4,
    collaboration: 4,
    reliability: 4,
    technical: 4,
  });
  const [hoveredDim, setHoveredDim] = useState<Partial<Record<FeedbackDimension, number>>>({});
  const [content, setContent] = useState("");
  const [endorsedSkills, setEndorsedSkills] = useState<Set<string>>(new Set());
  const [isPreview, setIsPreview] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  const toggleSkill = (skill: string) => {
    setEndorsedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) {
        next.delete(skill);
      } else {
        if (next.size >= 10) return prev; // max 10
        next.add(skill);
      }
      return next;
    });
  };

  const observedCount = Object.values(dimensions).filter((v) => v !== null).length;

  const handleSubmit = async () => {
    if (!selectedProjectId) {
      toast("Please select a completed project", "error");
      return;
    }

    if (observedCount === 0) {
      toast("Please rate at least one feedback dimension", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          revieweeId,
          ratingCommunication: dimensions.communication,
          ratingCollaboration: dimensions.collaboration,
          ratingReliability: dimensions.reliability,
          ratingTechnical: dimensions.technical,
          content: content.trim() || undefined,
          skillsEndorsed: Array.from(endorsedSkills),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast("Collaboration feedback submitted successfully!", "success");
        setIsOpen(false);
        setIsPreview(false);
        router.refresh();
      } else {
        toast(data.error || "Failed to submit review", "error");
      }
    } catch {
      toast("An error occurred. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (projects.length === 0) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setIsPreview(false);
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" className="gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Leave Collaboration Review
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Review {revieweeName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Provide fair, behavior-focused evaluation on a shared completed project.
          </p>
        </DialogHeader>

        {!isPreview ? (
          <div className="space-y-5 py-3">
            {/* Project Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Which completed project did you collaborate on?</Label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Behavioral Dimensions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Feedback Dimensions</span>
                <span>Select "Not Observed" to omit</span>
              </div>

              {FEEDBACK_DIMENSIONS.map((dim) => {
                const val = dimensions[dim.key];
                const isObserved = val !== null;
                const hovered = hoveredDim[dim.key] || 0;
                const display = isObserved ? hovered || val : 0;

                return (
                  <div
                    key={dim.key}
                    className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-foreground">{dim.label}</span>
                        <p className="text-[11px] text-muted-foreground">{dim.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDimensions((prev) => ({
                            ...prev,
                            [dim.key]: isObserved ? null : 4,
                          }))
                        }
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded border transition-colors",
                          !isObserved
                            ? "bg-muted text-muted-foreground border-border/80"
                            : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        )}
                      >
                        {isObserved ? "Active" : "Not Observed"}
                      </button>
                    </div>

                    {isObserved ? (
                      <div className="flex items-center gap-2 pt-0.5">
                        <div
                          className="flex items-center gap-1"
                          onMouseLeave={() =>
                            setHoveredDim((prev) => ({ ...prev, [dim.key]: 0 }))
                          }
                        >
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setDimensions((prev) => ({ ...prev, [dim.key]: star }))
                              }
                              onMouseEnter={() =>
                                setHoveredDim((prev) => ({ ...prev, [dim.key]: star }))
                              }
                              className="p-0.5 hover:scale-110 transition-transform focus:outline-none"
                            >
                              <Star
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  star <= display
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30 fill-muted/10"
                                )}
                              />
                            </button>
                          ))}
                        </div>
                        <span className="text-[11px] font-medium text-amber-500">
                          {display === 1 && "Needs Improvement"}
                          {display === 2 && "Fair"}
                          {display === 3 && "Good"}
                          {display === 4 && "Great"}
                          {display === 5 && "Exceptional"}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">
                        Marked as Not Observed — will not affect the score for this dimension.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Written Feedback */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Concise Written Feedback (Optional)</Label>
              <Textarea
                placeholder="Keep feedback concise and behavior-focused. Avoid claims about personality or personal characteristics."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="resize-none h-20 text-xs"
                maxLength={500}
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" /> Editable for up to 48 hours
                </span>
                <span>{content.length}/500</span>
              </div>
            </div>

            {/* Endorse Skills */}
            {skills.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Endorse Demonstrated Skills</Label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skills.map((skill) => {
                    const isEndorsed = endorsedSkills.has(skill);
                    return (
                      <Badge
                        key={skill}
                        variant="outline"
                        className={cn(
                          "cursor-pointer hover:bg-muted/80 transition-colors select-none text-[11px] py-0.5",
                          isEndorsed &&
                            "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                        )}
                        onClick={() => toggleSkill(skill)}
                      >
                        {isEndorsed && <Check className="w-3 h-3 mr-1" />}
                        {skill}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Preview Mode */
          <div className="space-y-4 py-4">
            <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> Preview Feedback
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Confirm before publishing
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {FEEDBACK_DIMENSIONS.map((dim) => {
                  const val = dimensions[dim.key];
                  return (
                    <div
                      key={dim.key}
                      className="p-2 rounded bg-background/80 border border-border/40"
                    >
                      <div className="text-[11px] text-muted-foreground">{dim.label}</div>
                      <div className="font-semibold text-foreground">
                        {val !== null ? `${val} / 5 Stars` : "Not Observed"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {content.trim() ? (
                <div className="p-2.5 rounded bg-background/80 border border-border/40 text-xs italic text-foreground/90">
                  "{content.trim()}"
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No written comment provided.</p>
              )}

              {endorsedSkills.size > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {Array.from(endorsedSkills).map((s) => (
                    <span
                      key={s}
                      className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      + {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          {!isPreview ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setIsPreview(true)}
                disabled={loading || !selectedProjectId || observedCount === 0}
                className="gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Feedback
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreview(false)}
                disabled={loading}
                className="gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Edit
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={loading}
                className="gap-1.5 bg-primary"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    Confirm & Submit <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
