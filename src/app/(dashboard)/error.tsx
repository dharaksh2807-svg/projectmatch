"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="p-8 max-w-xl mx-auto text-center animate-fade-in my-12">
      <div className="w-14 h-14 rounded-2xl bg-destructive/15 border border-destructive/30 flex items-center justify-center mx-auto mb-5 text-destructive shadow-sm">
        <AlertCircle className="w-7 h-7" />
      </div>

      <h2 className="text-xl font-bold tracking-tight mb-2">
        Unable to load dashboard data
      </h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        {error.message || "An unexpected error occurred while loading this page. Please try again."}
      </p>

      <div className="flex items-center justify-center gap-3">
        <Button
          onClick={() => reset()}
          className="brand-gradient text-white gap-2 font-medium shadow-sm hover:opacity-90 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
