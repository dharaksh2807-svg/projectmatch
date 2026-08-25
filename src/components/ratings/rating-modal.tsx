"use client";

import * as React from "react";
import { Star, Loader2, CheckCircle2, X, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { ratingSchema } from "@/lib/validations";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Peer {
  id: string;
  name: string | null;
  image: string | null;
  experienceLevel: string | null;
}

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  peers: Peer[];
  /** Called after all peers are rated so parent can refresh state */
  onAllRated?: () => void;
}

// ─── Star Rating Input ────────────────────────────────────────────────────────

function StarInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = React.useState(0);
  const display = hovered || value;

  return (
    <div className="flex items-center gap-1" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={cn(
            "transition-all duration-100 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"
          )}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "w-7 h-7 transition-colors",
              star <= display
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Single Peer Rating Card ──────────────────────────────────────────────────

function PeerRatingCard({
  peer,
  projectId,
  onRated,
}: {
  peer: Peer;
  projectId: string;
  onRated: (peerId: string) => void;
}) {
  const { toast } = useToast();
  const [score, setScore] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const initials = (peer.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSubmit() {
    const validation = ratingSchema.safeParse({
      projectId,
      rateeId: peer.id,
      score,
      comment: comment.trim() || undefined,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message || "Invalid rating input.";
      toast(firstError, "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const data = await res.json();
      if (res.status === 201) {
        setSubmitted(true);
        toast(
          `Rating for ${peer.name || "teammate"} submitted! Their new reputation: ${data.newReputationScore?.toFixed(1)}/100`,
          "success"
        );
        onRated(peer.id);
      } else if (res.status === 409) {
        setSubmitted(true);
        toast(data.error || "You have already rated this teammate.", "info");
        onRated(peer.id);
      } else {
        toast(data.error || "Failed to submit rating.", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all duration-200",
        submitted
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/60 bg-card/60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {peer.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={peer.image}
            alt={peer.name || "Teammate"}
            className="w-10 h-10 rounded-full ring-2 ring-border flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{peer.name || "Anonymous"}</p>
              {peer.experienceLevel && (
                <p className="text-[11px] text-muted-foreground">{peer.experienceLevel}</p>
              )}
            </div>

            {submitted ? (
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Rated
              </div>
            ) : (
              <StarInput value={score} onChange={setScore} disabled={submitting} />
            )}
          </div>

          {/* Comment field */}
          {!submitted && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <MessageSquare className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground/50" />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                  placeholder="Leave an optional comment…"
                  rows={2}
                  maxLength={500}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-secondary/40 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 resize-none transition-colors"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || score === 0}
                className={cn(
                  "w-full py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                  score === 0
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 shadow-sm"
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Star className="w-3.5 h-3.5" />
                    Submit Rating
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function RatingModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  peers,
  onAllRated,
}: RatingModalProps) {
  const [ratedIds, setRatedIds] = React.useState<Set<string>>(new Set());

  const handleRated = React.useCallback((peerId: string) => {
    setRatedIds((prev) => {
      const next = new Set(prev).add(peerId);
      return next;
    });
  }, []);

  // Call onAllRated when every peer has been rated
  const allDone = peers.length > 0 && ratedIds.size >= peers.length;
  React.useEffect(() => {
    if (allDone) {
      onAllRated?.();
    }
  }, [allDone, onAllRated]);

  // Trap body scroll while open
  React.useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Blurred overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[#16161f] border border-border/60 shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border/50 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-white fill-white" />
              </div>
              <h2 className="text-base font-bold">Rate Your Teammates</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">{projectTitle}</span> is complete!
              Your ratings help improve future team matches for everyone.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 bg-secondary/20 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Rating progress</span>
            <span className="font-semibold text-foreground">
              {ratedIds.size} / {peers.length} rated
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500"
              style={{ width: peers.length > 0 ? `${(ratedIds.size / peers.length) * 100}%` : "0%" }}
            />
          </div>
        </div>

        {/* Peer list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {peers.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              You&apos;ve already rated all your teammates for this project!
            </div>
          ) : (
            peers.map((peer) => (
              <PeerRatingCard
                key={peer.id}
                peer={peer}
                projectId={projectId}
                onRated={handleRated}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex-shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Ratings are anonymous to teammates and feed into AI match scores.
          </p>
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            {allDone ? "Close" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );
}
