"use client";

import * as React from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
  className?: string;
  align?: "start" | "end" | "center";
  showLabel?: boolean;
}

export function ModeToggle({
  className,
  align = "end",
  showLabel = false,
}: ModeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Close menu on click outside or escape key
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 rounded-lg opacity-0 pointer-events-none", className)}
        aria-hidden="true"
        disabled
      >
        <Moon className="h-4 w-4" />
      </Button>
    );
  }

  const triggerLabel = "Change appearance";

  const CurrentIcon =
    theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;

  return (
    <div className={cn("relative inline-block text-left", showLabel && "w-full")} ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground relative transition-colors focus-visible:ring-2 focus-visible:ring-primary",
          isOpen && "bg-secondary text-foreground",
          className
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={triggerLabel}
      >
        <CurrentIcon className="h-4 w-4 shrink-0 transition-transform" />
        <span className="sr-only">{triggerLabel}</span>
      </Button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label="Appearance options"
          className={cn(
            "absolute mt-1.5 w-40 rounded-xl bg-popover border border-border text-popover-foreground shadow-lg shadow-black/40 z-50 p-1 space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-100",
            align === "end"
              ? "right-0"
              : align === "start"
              ? "left-0"
              : "left-1/2 -translate-x-1/2"
          )}
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
            Appearance
          </div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={theme === "light"}
            onClick={() => {
              setTheme("light");
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-left",
              theme === "light"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 shrink-0" />
              <span>Light</span>
            </span>
            {theme === "light" && <Check className="h-3.5 w-3.5 text-primary stroke-[2.5]" />}
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={theme === "dark"}
            onClick={() => {
              setTheme("dark");
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-left",
              theme === "dark"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 shrink-0" />
              <span>Dark</span>
            </span>
            {theme === "dark" && <Check className="h-3.5 w-3.5 text-primary stroke-[2.5]" />}
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={theme === "system"}
            onClick={() => {
              setTheme("system");
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-left",
              theme === "system"
                ? "bg-secondary text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 shrink-0" />
              <span>System</span>
            </span>
            {theme === "system" && <Check className="h-3.5 w-3.5 text-primary stroke-[2.5]" />}
          </button>
        </div>
      )}
    </div>
  );
}
