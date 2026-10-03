"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Briefcase,
  Megaphone,
  Loader2,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";

interface NotificationItem {
  id: string;
  type: "APPLICATION_RECEIVED" | "APPLICATION_ACCEPTED" | "APPLICATION_REJECTED" | "NEW_MESSAGE" | "SYSTEM";
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_CONFIG = {
  APPLICATION_RECEIVED: { icon: Briefcase, color: "text-blue-500 bg-blue-500/10" },
  APPLICATION_ACCEPTED: { icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
  APPLICATION_REJECTED: { icon: XCircle, color: "text-destructive bg-destructive/10" },
  NEW_MESSAGE: { icon: Bell, color: "text-primary bg-primary/10" },
  SYSTEM: { icon: Megaphone, color: "text-amber-500 bg-amber-500/10" },
};

export default function NotificationsPage() {
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionStatus !== "loading") {
      loadNotifications();
    }
  }, [sessionStatus]);

  async function markAllAsRead() {
    setMarkingRead(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // empty body marks all
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        toast("All notifications marked as read.", "success");
      }
    } catch {
      toast("Failed to mark read.", "error");
    } finally {
      setMarkingRead(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay updated on your applications and project activity.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={markingRead}
            className="text-xs h-8"
          >
            {markingRead ? (
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            ) : (
              <Check className="w-3 h-3 mr-2" />
            )}
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="All caught up!"
          description="You don't have any notifications right now."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.SYSTEM;
            const Icon = cfg.icon;

            const content = (
              <Card
                className={cn(
                  "p-4 transition-all border",
                  n.isRead
                    ? "bg-card/40 border-transparent"
                    : "bg-card border-primary/20 shadow-sm"
                )}
              >
                <div className="flex gap-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      cfg.color
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3
                        className={cn(
                          "font-semibold text-sm",
                          n.isRead ? "text-foreground/80" : "text-foreground"
                        )}
                      >
                        {n.title}
                      </h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        n.isRead ? "text-muted-foreground" : "text-foreground/90"
                      )}
                    >
                      {n.body}
                    </p>
                  </div>
                </div>
              </Card>
            );

            if (n.link) {
              return (
                <Link key={n.id} href={n.link} className="block group">
                  <div className="group-hover:scale-[1.01] transition-transform">
                    {content}
                  </div>
                </Link>
              );
            }
            return <div key={n.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
