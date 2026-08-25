"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReputationBadgeProps {
  score: number;          // 0–100
  showLabel?: boolean;    // show "/100" suffix
  size?: "xs" | "sm" | "md";
  className?: string;
}

function getTierStyle(score: number) {
  if (score >= 90) return { color: "text-amber-400", fill: "fill-amber-400", label: "Top Rated" };
  if (score >= 75) return { color: "text-emerald-400", fill: "fill-emerald-400", label: "Highly Rated" };
  if (score >= 60) return { color: "text-sky-400", fill: "fill-sky-400", label: "Well Rated" };
  if (score === 50) return { color: "text-muted-foreground", fill: "", label: "New" };
  return { color: "text-muted-foreground", fill: "", label: "Rated" };
}

export function ReputationBadge({
  score,
  showLabel = false,
  size = "sm",
  className,
}: ReputationBadgeProps) {
  const { color, fill, label } = getTierStyle(score);

  const sizeMap = {
    xs: { star: "w-2.5 h-2.5", text: "text-[10px]", gap: "gap-0.5" },
    sm: { star: "w-3 h-3", text: "text-xs", gap: "gap-1" },
    md: { star: "w-4 h-4", text: "text-sm", gap: "gap-1" },
  };
  const sz = sizeMap[size];

  return (
    <span
      className={cn("inline-flex items-center font-medium", sz.gap, color, className)}
      title={`Reputation: ${score.toFixed(1)}/100 — ${label}`}
    >
      <Star className={cn(sz.star, fill || color)} />
      <span className={sz.text}>
        {score.toFixed(1)}
        {showLabel && <span className="text-muted-foreground font-normal">/100</span>}
      </span>
    </span>
  );
}
