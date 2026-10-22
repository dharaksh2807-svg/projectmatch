"use client";

import * as React from "react";
import {
  Star,
  Loader2,
  CheckCircle2,
  X,
  MessageSquare,
  ShieldCheck,
  Eye,
  ArrowRight,
  ArrowLeft,
  Info,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { FEEDBACK_DIMENSIONS, FeedbackDimension } from "@/lib/reputation/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Peer {
  id: string;
  name: string | null;
  image: string | null;
  experienceLevel: string | null;
  skills?: string[];
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

// ─── Dimension Rating Input with "Not Observed" option ─────────────────────────

function DimensionSelector({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: number | null;
  onChange: (val: number | null) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = React.useState(0);
  const isObserved = value !== null;
  const displayVal = isObserved ? (hovered || value) : 0;

  return (
    <div className="space-y-1.5 p-3 rounded-lg border border-border/50 bg-background/50">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(isObserved ? null : 4)}
          className={cn(
            "text-[11px] font-medium px-2 py-0.5 rounded transition-colors border",
            !isObserved
              ? "bg-muted/80 text-muted-foreground border-border/80"
              : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
          )}
        >
          {isObserved ? "Active" : "Not Observed"}
        </button>
      </div>

      {isObserved ? (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={disabled}
                onClick={() => onChange(star)}
                onMouseEnter={() => setHovered(star)}
                className="p-1 -ml-1 transition-transform hover:scale-110 focus:outline-none"
                aria-label={`${star} star`}
              >
                <Star
                  className={cn(
                    "w-5 h-5 transition-colors",
                    star <= displayVal
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30 fill-muted/10"
                  )}
                />
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-amber-500">
            {displayVal === 1 && "Needs Improvement"}
            {displayVal === 2 && "Fair"}
            {displayVal === 3 && "Good"}
            {displayVal === 4 && "Great"}
            {displayVal === 5 && "Exceptional"}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic pt-0.5">
          Marked as Not Observed. This will not affect the score for this dimension.
        </p>
      )}
    </div>
  );
}

// ─── Single Peer Collaboration Review Card ────────────────────────────────────

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
  const [dimensions, setDimensions] = React.useState<Record<FeedbackDimension, number | null>>({
    communication: 4,
    collaboration: 4,
    reliability: 4,
    technical: 4,
  });
  const [content, setContent] = React.useState("");
  const [isPreview, setIsPreview] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const initials = (peer.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const observedDimensions = Object.entries(dimensions).filter(
    ([, val]) => typeof val === "number" && val !== null
  );

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          revieweeId: peer.id,
          ratingCommunication: dimensions.communication,
          ratingCollaboration: dimensions.collaboration,
          ratingReliability: dimensions.reliability,
          ratingTechnical: dimensions.technical,
          content: content.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.status === 201) {
        setSubmitted(true);
        toast(
          `Collaboration review for ${peer.name || "teammate"} submitted! Their updated reputation score is ${data.newReputationScore}/100`,
          "success"
        );
        onRated(peer.id);
      } else if (res.status === 409) {
        setSubmitted(true);
        toast(data.error || "You have already reviewed this teammate.", "info");
        onRated(peer.id);
      } else {
        toast(data.error || "Failed to submit review.", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-300">
            Feedback submitted for {peer.name || "teammate"}
          </p>
          <p className="text-xs text-muted-foreground">
            Thank you for contributing to fair and trustworthy reputation on ProjectMatch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5 space-y-4 shadow-sm">
      {/* Teammate Header */}
      <div className="flex items-center gap-3">
        {peer.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={peer.image}
            alt={peer.name || "Teammate"}
            className="w-10 h-10 rounded-full ring-2 ring-border flex-shrink-0 object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {peer.name || "Teammate"}
          </p>
          <p className="text-xs text-muted-foreground">
            {peer.experienceLevel || "Contributor"} • Verified Teammate
          </p>
        </div>
        <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Eligible
        </span>
      </div>

      {!isPreview ? (
        <>
          {/* Dimension Selectors */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Behavior-focused evaluation</span>
              <span>Select "Not Observed" if unobserved</span>
            </div>
            {FEEDBACK_DIMENSIONS.map((dim) => (
              <DimensionSelector
                key={dim.key}
                label={dim.label}
                description={dim.description}
                value={dimensions[dim.key]}
                onChange={(val) =>
                  setDimensions((prev) => ({ ...prev, [dim.key]: val }))
                }
                disabled={submitting}
              />
            ))}
          </div>

          {/* Written Feedback */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              Concise Written Feedback (Optional)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Keep feedback concise and behavior-focused (e.g., clear communication, proactive PR reviews). Avoid claims about personality or personal characteristics."
              maxLength={500}
              disabled={submitting}
              className="w-full text-xs rounded-lg border border-border/70 bg-background/70 p-3 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary h-20 resize-none"
            />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" /> Editable for up to 48 hours after submission
              </span>
              <span>{content.length}/500</span>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={submitting || observedDimensions.length === 0}
              onClick={() => setIsPreview(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" /> Preview Feedback
            </button>
          </div>
        </>
      ) : (
        /* Preview Step */
        <div className="space-y-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> Review Preview Before Submission
            </h4>
            <span className="text-[10px] text-muted-foreground">
              Verify accuracy before publishing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {FEEDBACK_DIMENSIONS.map((dim) => {
              const val = dimensions[dim.key];
              return (
                <div key={dim.key} className="p-2 rounded bg-background/80 border border-border/40">
                  <div className="text-[11px] font-medium text-muted-foreground">{dim.label}</div>
                  <div className="font-semibold text-foreground">
                    {val !== null ? `${val} / 5 Stars` : "Not Observed (Excluded)"}
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

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsPreview(false)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Edit
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  Confirm & Submit Review <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rating Modal Component ───────────────────────────────────────────────────

export function RatingModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  peers,
  onAllRated,
}: RatingModalProps) {
  const [ratedPeerIds, setRatedPeerIds] = React.useState<Set<string>>(new Set());

  const remainingPeers = peers.filter((p) => !ratedPeerIds.has(p.id));

  function handlePeerRated(peerId: string) {
    setRatedPeerIds((prev) => {
      const next = new Set(prev);
      next.add(peerId);
      if (next.size >= peers.length) {
        onAllRated?.();
      }
      return next;
    });
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border/80 bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border/60 bg-muted/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Collaboration Feedback
              </span>
              <span className="text-xs text-muted-foreground">• Completed Project</span>
            </div>
            <h2 id="rating-modal-title" className="text-xl font-bold text-foreground">
              Rate Teammates — {projectTitle}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Provide fair, behavior-focused evaluation for teammates with whom you verifiably collaborated.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {peers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-80" />
              <p className="text-sm font-medium">All eligible teammates have been reviewed.</p>
              <p className="text-xs mt-1">
                Your collaboration feedback helps maintain a trustworthy community.
              </p>
            </div>
          ) : (
            peers.map((peer) => (
              <PeerRatingCard
                key={peer.id}
                peer={peer}
                projectId={projectId}
                onRated={handlePeerRated}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {remainingPeers.length === 0
              ? "All teammates evaluated"
              : `${remainingPeers.length} teammate${remainingPeers.length > 1 ? "s" : ""} remaining`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-border/80 hover:bg-muted transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
