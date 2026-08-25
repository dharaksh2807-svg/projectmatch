import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Avatar({
  src,
  alt = "User",
  fallback,
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const [hasError, setHasError] = React.useState(false);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const getFallback = () => {
    if (fallback) return fallback;
    if (alt) return alt.slice(0, 2).toUpperCase();
    return "U";
  };

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden flex items-center justify-center font-semibold select-none flex-shrink-0 bg-secondary text-secondary-foreground border border-border/50",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {src && !hasError ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="brand-gradient text-white flex items-center justify-center w-full h-full">
          {getFallback()}
        </span>
      )}
    </div>
  );
}
