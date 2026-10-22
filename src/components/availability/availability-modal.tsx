"use client";

import { X } from "lucide-react";
import { AvailabilityEditor } from "./availability-editor";
import { UserScheduleData } from "@/lib/scheduling/types";

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (schedule: UserScheduleData) => void;
}

export function AvailabilityModal({ isOpen, onClose, onSaved }: AvailabilityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl p-4 sm:p-6 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <AvailabilityEditor
          onSaved={(schedule) => {
            if (onSaved) onSaved(schedule);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
