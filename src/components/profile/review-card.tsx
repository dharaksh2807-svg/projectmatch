"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Star,
  CheckCircle2,
  Edit2,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  Flag,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/toast-provider";
import { useRouter } from "next/navigation";
import { FEEDBACK_DIMENSIONS, FeedbackDimension } from "@/lib/reputation/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ReviewItemData {
  id: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  ratingCommunication: number | null;
  ratingCollaboration: number | null;
  ratingReliability: number | null;
  ratingTechnical: number | null;
  content: string | null;
  skillsEndorsed: string[];
  createdAt: Date | string;
  isEdited: boolean;
  editedAt?: Date | string | null;
  responseContent?: string | null;
  respondedAt?: Date | string | null;
  isDisputed: boolean;
  disputeReason?: string | null;
  disputeStatus?: string | null;
  reviewer: {
    id: string;
    name: string | null;
    image: string | null;
  };
  project: {
    id: string;
    title: string;
  };
}

interface ReviewCardProps {
  review: ReviewItemData;
  loggedInUserId?: string;
  revieweeName: string;
}

export function ReviewCard({ review, loggedInUserId, revieweeName }: ReviewCardProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  // Form states
  const [editDimensions, setEditDimensions] = useState<Record<FeedbackDimension, number | null>>({
    communication: review.ratingCommunication,
    collaboration: review.ratingCollaboration,
    reliability: review.ratingReliability,
    technical: review.ratingTechnical,
  });
  const [editContent, setEditContent] = useState(review.content || "");
  const [responseText, setResponseText] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isReviewer = loggedInUserId === review.reviewerId;
  const isReviewee = loggedInUserId === review.revieweeId;

  // 48 hour edit window calculation
  const reviewCreatedAt = new Date(review.createdAt).getTime();
  const hoursSinceCreation = (Date.now() - reviewCreatedAt) / (1000 * 60 * 60);
  const canEdit = isReviewer && hoursSinceCreation <= 48;
  const canRespond = isReviewee && !review.responseContent;
  const canDispute = isReviewee && !review.isDisputed;

  // Edit Review Submit
  const handleEditSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratingCommunication: editDimensions.communication,
          ratingCollaboration: editDimensions.collaboration,
          ratingReliability: editDimensions.reliability,
          ratingTechnical: editDimensions.technical,
          content: editContent.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast("Review updated successfully!", "success");
        setEditOpen(false);
        router.refresh();
      } else {
        toast(data.error || "Failed to update review", "error");
      }
    } catch {
      toast("Error updating review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Response Submit
  const handleResponseSubmit = async () => {
    if (!responseText.trim() || responseText.trim().length < 5) {
      toast("Response must be at least 5 characters", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseContent: responseText.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        toast("Response posted successfully!", "success");
        setResponseOpen(false);
        router.refresh();
      } else {
        toast(data.error || "Failed to post response", "error");
      }
    } catch {
      toast("Error submitting response", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Dispute Submit
  const handleDisputeSubmit = async () => {
    if (!disputeReason.trim() || disputeReason.trim().length < 10) {
      toast("Dispute reason must be at least 10 characters", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disputeReason.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        toast("Dispute submitted to trust and safety moderation queue.", "success");
        setDisputeOpen(false);
        router.refresh();
      } else {
        toast(data.error || "Failed to submit dispute", "error");
      }
    } catch {
      toast("Error submitting dispute", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 shadow-sm bg-card/60 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-border">
      <CardContent className="p-5 space-y-4">
        {/* Header with reviewer info, project, and badges */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              src={review.reviewer.image || undefined}
              alt={review.reviewer.name || "Reviewer"}
              size="sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground">
                  {review.reviewer.name || "Anonymous Teammate"}
                </p>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400 bg-emerald-500/5 flex items-center gap-0.5"
                >
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified Teammate
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Completed Project:{" "}
                <span className="font-medium text-foreground/85">{review.project.title}</span> •{" "}
                {formatDistanceToNow(new Date(review.createdAt))} ago
                {review.isEdited && (
                  <span
                    className="ml-1.5 text-muted-foreground/75 italic cursor-help"
                    title={
                      review.editedAt
                        ? `Edited on ${new Date(review.editedAt).toLocaleString()}`
                        : "Edited"
                    }
                  >
                    (edited)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <div className="flex text-amber-500 items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-4 h-4",
                    i < review.rating
                      ? "fill-amber-400 text-amber-400"
                      : "fill-muted text-muted-foreground/20"
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-foreground ml-1">{review.rating}.0</span>
          </div>
        </div>

        {/* Behavioral Dimensions Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {FEEDBACK_DIMENSIONS.map((dim) => {
            const val =
              dim.key === "communication"
                ? review.ratingCommunication
                : dim.key === "collaboration"
                ? review.ratingCollaboration
                : dim.key === "reliability"
                ? review.ratingReliability
                : review.ratingTechnical;

            return (
              <div
                key={dim.key}
                className="p-2 rounded-lg bg-muted/30 border border-border/40 text-xs flex flex-col justify-between"
              >
                <span className="text-[11px] text-muted-foreground font-medium truncate">
                  {dim.label}
                </span>
                <span className="font-semibold text-foreground mt-1 flex items-center gap-1">
                  {val !== null ? (
                    <>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {val}/5
                    </>
                  ) : (
                    <span className="text-muted-foreground/70 font-normal italic text-[10px]">
                      Not Observed
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Concise written feedback */}
        {review.content && (
          <p className="text-sm text-foreground/90 leading-relaxed italic bg-muted/20 p-3 rounded-lg border border-border/30">
            "{review.content}"
          </p>
        )}

        {/* Endorsed skills */}
        {review.skillsEndorsed && review.skillsEndorsed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Demonstrated Skills:
            </span>
            {review.skillsEndorsed.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="text-[10px] px-2 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
              >
                {s}
              </Badge>
            ))}
          </div>
        )}

        {/* Reviewee Official Response */}
        {review.responseContent && (
          <div className="mt-3 p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Response from {revieweeName}
              </span>
              {review.respondedAt && (
                <span className="text-[10px] text-muted-foreground font-normal">
                  {formatDistanceToNow(new Date(review.respondedAt))} ago
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed italic">
              "{review.responseContent}"
            </p>
          </div>
        )}

        {/* Dispute Status Banner */}
        {review.isDisputed && (
          <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-400">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Review under dispute moderation ({review.disputeStatus || "PENDING"})
            </span>
            <span className="text-[10px] text-muted-foreground">Under Review</span>
          </div>
        )}

        {/* Action Controls for Author & Recipient */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Edit2 className="w-3 h-3" /> Edit (48h window)
              </Button>
            )}

            {canRespond && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResponseOpen(true)}
                className="h-7 text-xs gap-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              >
                <MessageSquare className="w-3 h-3" /> Respond to Feedback
              </Button>
            )}

            {canDispute && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDisputeOpen(true)}
                className="h-7 text-xs gap-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                <Flag className="w-3 h-3" /> Dispute / Report
              </Button>
            )}
          </div>

          <span className="text-[10px] text-muted-foreground ml-auto">
            Verified Collaboration System
          </span>
        </div>
      </CardContent>

      {/* Edit Modal (Within 48h) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" /> Edit Collaboration Feedback
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-xs text-muted-foreground">
              You can adjust ratings or update your written comment during the 48-hour editing window.
            </p>
            {FEEDBACK_DIMENSIONS.map((dim) => {
              const val = editDimensions[dim.key];
              return (
                <div key={dim.key} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-xs font-medium">{dim.label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setEditDimensions((prev) => ({ ...prev, [dim.key]: star }))
                        }
                        className="p-1"
                      >
                        <Star
                          className={cn(
                            "w-4 h-4",
                            val !== null && star <= val
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setEditDimensions((prev) => ({
                          ...prev,
                          [dim.key]: val === null ? 4 : null,
                        }))
                      }
                      className="text-[10px] ml-1 text-muted-foreground hover:underline"
                    >
                      {val === null ? "Activate" : "Omit"}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Written Comment</label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={500}
                className="text-xs resize-none h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleEditSubmit} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response Modal */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> Respond to Collaboration Feedback
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-xs text-muted-foreground">
              Provide a professional, factual response to this review. Your response will be publicly visible alongside the review on your profile.
            </p>
            <Textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="e.g. Thanks for the feedback! It was great collaborating on the authentication and deployment pipeline during the hackathon."
              maxLength={500}
              className="text-xs resize-none h-24"
            />
            <div className="text-[10px] text-right text-muted-foreground">
              {responseText.length}/500
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResponseOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleResponseSubmit} disabled={submitting}>
              {submitting ? "Posting..." : "Post Official Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Modal */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <Flag className="w-4 h-4" /> Dispute Collaboration Review
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-xs text-muted-foreground">
              If this review contains harassment, personal attacks, defamatory claims, or violates collaboration guidelines, submit a dispute for moderation review.
            </p>
            <Textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Explain why this review violates community guidelines or is retaliatory (minimum 10 characters)..."
              maxLength={500}
              className="text-xs resize-none h-24"
            />
            <div className="text-[10px] text-right text-muted-foreground">
              {disputeReason.length}/500
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDisputeSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit to Moderation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
