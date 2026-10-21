"use client";

import * as React from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ModeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
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
        className={cn("w-9 h-9 rounded-xl opacity-0", className)}
        aria-hidden="true"
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const currentThemeLabel =
    theme === "system"
      ? `System (${resolvedTheme === "dark" ? "Dark" : "Light"})`
      : theme === "dark"
      ? "Dark"
      : "Light";

  const triggerLabel = `Theme: ${currentThemeLabel}. Click to select Light, Dark, or System.`;

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "w-9 h-9 rounded-xl text-foreground/80 hover:bg-secondary hover:text-foreground relative transition-colors focus-visible:ring-2 focus-visible:ring-primary",
          isOpen && "bg-secondary text-foreground",
          className
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={triggerLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={triggerLabel}
      >
        {theme === "system" ? (
          <Monitor className="h-4 w-4 text-primary transition-transform" />
        ) : theme === "dark" ? (
          <Moon className="h-4 w-4 text-purple-400 transition-transform" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500 transition-transform" />
        )}
        <span className="sr-only">{triggerLabel}</span>
      </Button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="theme-menu"
          className="absolute right-0 mt-2 w-48 rounded-xl bg-popover border border-border text-popover-foreground shadow-lg shadow-black/10 z-50 p-1.5 space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Appearance
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTheme("light");
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors text-left",
              theme === "light"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground/90 hover:bg-secondary hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Light</span>
            </span>
            {theme === "light" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTheme("dark");
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors text-left",
              theme === "dark"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground/90 hover:bg-secondary hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-purple-400" />
              <span>Dark</span>
            </span>
            {theme === "dark" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTheme("system");
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors text-left",
              theme === "system"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground/90 hover:bg-secondary hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              <span>System</span>
            </span>
            {theme === "system" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}
