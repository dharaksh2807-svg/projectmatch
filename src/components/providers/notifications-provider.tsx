"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast-provider";

interface NotificationsContextType {
  unreadCount: number;
  decrementUnread: () => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial unread count
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchInitialCount = async () => {
      try {
        const res = await fetch("/api/notifications?unreadOnly=true");
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch (err) {
        console.error("Failed to fetch initial unread count:", err);
      }
    };

    fetchInitialCount();
  }, [status]);

  // Setup SSE stream for real-time notifications
  useEffect(() => {
    if (status !== "authenticated") return;

    const eventSource = new EventSource("/api/notifications/stream");

    eventSource.addEventListener("notification", (e) => {
      try {
        const notification = JSON.parse(e.data);
        
        // Only show toast if it's not a message (messages are handled in chat UI) or maybe we do want toast for messages when not in chat?
        // Actually, the requirement asks for toast alerts: "New message from X" or "Application received"
        toast(notification.title || "New Notification", "info");
        
        // Increment unread count
        setUnreadCount((prev) => prev + 1);
      } catch (err) {
        console.error("Error parsing notification stream data:", err);
      }
    });

    eventSource.onerror = (err) => {
      console.error("SSE stream error:", err);
      // EventSource automatically attempts to reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [status, toast]);

  const decrementUnread = () => setUnreadCount((prev) => Math.max(0, prev - 1));
  const markAllRead = () => setUnreadCount(0);

  return (
    <NotificationsContext.Provider value={{ unreadCount, decrementUnread, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
