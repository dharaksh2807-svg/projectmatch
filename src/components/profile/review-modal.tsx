"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [content, setContent] = useState("");
  const [endorsedSkills, setEndorsedSkills] = useState<Set<string>>(new Set());
  
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

  const handleSubmit = async () => {
    if (!selectedProjectId) {
      toast("Please select a project", "error");
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
          rating,
          content,
          skillsEndorsed: Array.from(endorsedSkills),
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        toast("Review submitted successfully!", "success");
        setIsOpen(false);
        router.refresh();
      } else {
        toast(data.error || "Failed to submit review", "error");
      }
    } catch (err) {
      toast("An error occurred. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (projects.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-2">
            <Star className="w-4 h-4 fill-current" />
            Leave a Review
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Review {revieweeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Which project did you work on together?</Label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  className="p-1 -ml-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "w-8 h-8 transition-colors",
                      (hoverRating ? star <= hoverRating : star <= rating)
                        ? "fill-amber-500 text-amber-500"
                        : "fill-muted text-muted border-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Written Feedback (Optional)</Label>
            <Textarea
              placeholder="What was it like working with them? What did they excel at?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="resize-none h-24"
              maxLength={500}
            />
            <div className="text-[10px] text-right text-muted-foreground">
              {content.length}/500
            </div>
          </div>

          {skills.length > 0 && (
            <div className="space-y-2">
              <Label>Endorse Skills</Label>
              <p className="text-xs text-muted-foreground">Select up to 10 skills that they demonstrated on this project.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {skills.map((skill) => {
                  const isEndorsed = endorsedSkills.has(skill);
                  return (
                    <Badge
                      key={skill}
                      variant="outline"
                      className={cn(
                        "cursor-pointer hover:bg-muted/80 transition-colors select-none",
                        isEndorsed && "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedProjectId}>
            {loading ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
