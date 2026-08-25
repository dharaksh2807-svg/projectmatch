import { Construction } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="p-8 flex items-center justify-center min-h-96 animate-fade-in">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl glass border border-border mx-auto flex items-center justify-center mb-4">
          <Construction className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Notifications</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Coming in Phase 5 — get notified of new applications, invites, and team updates.</p>
      </div>
    </div>
  );
}
