"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error caught by root boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-destructive/15 border border-destructive/30 flex items-center justify-center mb-6 text-destructive shadow-lg shadow-destructive/10">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        {error.message || "An unexpected error occurred. Please try refreshing or returning home."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => reset()}
          className="brand-gradient text-white gap-2 font-medium shadow-sm hover:opacity-90 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
