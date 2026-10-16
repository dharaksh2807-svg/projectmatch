"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ModeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`w-9 h-9 opacity-0 ${className || ""}`}
        aria-hidden="true"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getLabel = () => {
    if (theme === "system") {
      return `Theme: System (${resolvedTheme === "dark" ? "Dark" : "Light"}). Click for Light mode.`;
    }
    if (theme === "dark") {
      return "Theme: Dark. Click for System mode.";
    }
    return "Theme: Light. Click for Dark mode.";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`w-9 h-9 text-foreground/80 hover:bg-accent hover:text-foreground relative rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-primary/40 ${
        className || ""
      }`}
      onClick={cycleTheme}
      title={getLabel()}
      aria-label={getLabel()}
    >
      {theme === "system" ? (
        <Monitor className="h-4 w-4 transition-all text-primary" />
      ) : theme === "dark" ? (
        <Moon className="h-4 w-4 transition-all text-amber-300" />
      ) : (
        <Sun className="h-4 w-4 transition-all text-amber-500" />
      )}
      <span className="sr-only">{getLabel()}</span>
    </Button>
  );
}
