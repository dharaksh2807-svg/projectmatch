"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global crash caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md p-8 rounded-2xl border border-border bg-card shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold mb-2">Application Error</h2>
          <p className="text-sm text-muted-foreground mb-6">
            A critical error occurred. Please reload the application.
          </p>
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
