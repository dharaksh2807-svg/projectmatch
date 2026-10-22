"use client";

import { Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReputationBadgeProps {
  score?: number | null; // 0–100
  reviewCount?: number; // Number of verified reviews
  showLabel?: boolean; // show "/100" suffix
  showCount?: boolean; // show "(X reviews)"
  size?: "xs" | "sm" | "md";
  className?: string;
}

function getTierStyle(score: number, reviewCount?: number) {
  if (reviewCount !== undefined && reviewCount < 2) {
    return {
      color: "text-muted-foreground",
      fill: "",
      label: reviewCount === 0 ? "New Contributor" : "Building Feedback (1 review)",
    };
  }
  if (score >= 90) return { color: "text-amber-400", fill: "fill-amber-400", label: "Top Rated" };
  if (score >= 75) return { color: "text-emerald-400", fill: "fill-emerald-400", label: "Highly Rated" };
  if (score >= 60) return { color: "text-sky-400", fill: "fill-sky-400", label: "Well Rated" };
  return { color: "text-muted-foreground", fill: "", label: "Rated" };
}

export function ReputationBadge({
  score,
  reviewCount,
  showLabel = false,
  showCount = false,
  size = "sm",
  className,
}: ReputationBadgeProps) {
  const effectiveScore = typeof score === "number" ? score : 50;
  const isLowData = reviewCount !== undefined && reviewCount < 2;

  const { color, fill, label } = getTierStyle(effectiveScore, reviewCount);

  const sizeMap = {
    xs: { star: "w-2.5 h-2.5", text: "text-[10px]", gap: "gap-0.5", px: "px-1.5 py-0.5" },
    sm: { star: "w-3 h-3", text: "text-xs", gap: "gap-1", px: "px-2 py-0.5" },
    md: { star: "w-3.5 h-3.5", text: "text-sm", gap: "gap-1.5", px: "px-2.5 py-1" },
  };
  const sz = sizeMap[size];

  // If there are zero reviews or low data, show fair, non-penalizing state
  if (isLowData) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-medium rounded-full bg-muted/50 border border-border/60 text-muted-foreground",
          sz.gap,
          sz.px,
          className
        )}
        title={
          reviewCount === 0
            ? "New contributor — not enough collaboration feedback yet. New users are not penalized."
            : "Building feedback — 1 verified review so far. Full score unlocks at 2+ reviews."
        }
      >
        <Sparkles className={cn(sz.star, "text-primary/70")} />
        <span className={sz.text}>
          {reviewCount === 0 ? "New Contributor" : "1 Verified Review"}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center font-medium", sz.gap, color, className)}
      title={`Reputation: ${effectiveScore.toFixed(1)}/100 — ${label}${
        reviewCount !== undefined ? ` (${reviewCount} verified reviews)` : ""
      }`}
    >
      <Star className={cn(sz.star, fill || color)} />
      <span className={sz.text}>
        {effectiveScore.toFixed(0)}
        {showLabel && <span className="text-muted-foreground font-normal">/100</span>}
        {showCount && reviewCount !== undefined && (
          <span className="text-muted-foreground font-normal text-[10px] ml-1">
            ({reviewCount})
          </span>
        )}
      </span>
    </span>
  );
}
