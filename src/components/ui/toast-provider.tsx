"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md pointer-events-auto animate-slide-up",
              t.variant === "success" &&
                "bg-emerald-950/90 border-emerald-500/30 text-emerald-100",
              t.variant === "error" &&
                "bg-red-950/90 border-red-500/30 text-red-100",
              t.variant === "info" &&
                "bg-card/90 border-border/60 text-foreground"
            )}
          >
            {t.variant === "success" && (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            {t.variant === "error" && (
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            {t.variant === "info" && (
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            )}
            <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
