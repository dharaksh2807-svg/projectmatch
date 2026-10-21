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
        "rounded-2xl border border-border bg-card p-8 sm:p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto shadow-xs",
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center mb-3.5 text-primary shadow-xs">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed">
        {description}
      </p>

      {actionLabel && (
        actionHref ? (
          <Link href={actionHref}>
            <Button className="shadow-xs">
              {actionLabel}
            </Button>
          </Link>
        ) : onAction ? (
          <Button onClick={onAction} className="shadow-xs">
            {actionLabel}
          </Button>
        ) : null
      )}

      {children}
    </div>
  );
}
