"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NavbarAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2" aria-live="polite">
        <div className="h-8 w-20 rounded-lg bg-secondary/80 animate-pulse flex items-center justify-center border border-border/40">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-label="Loading authentication status" />
        </div>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ size: "sm" }), "font-semibold shadow-xs")}
        >
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary"
      >
        Sign In
      </Link>
      <Link
        href="/login?mode=signup"
        className={cn(buttonVariants({ size: "sm" }), "font-semibold shadow-xs")}
      >
        Get Started
      </Link>
    </div>
  );
}
