import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-2xl border border-border/50 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-secondary/80 border border-border/60 flex items-center justify-center mb-4 text-muted-foreground shadow-sm">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && (
        actionHref ? (
          <Link href={actionHref}>
            <Button className="brand-gradient text-white font-medium shadow-sm hover:opacity-90 transition-all">
              {actionLabel}
            </Button>
          </Link>
        ) : onAction ? (
          <Button
            onClick={onAction}
            className="brand-gradient text-white font-medium shadow-sm hover:opacity-90 transition-all"
          >
            {actionLabel}
          </Button>
        ) : null
      )}

      {children}
    </div>
  );
}
