"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

interface NotificationsContextType {
  unreadCount: number;
  decrementUnread: () => void;
  markAllRead: () => void;
  latestNotification: any | null;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const { toast } = useToast();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // Keep a ref to the latest pathname so we can check it in the SSE listener without adding it to the dependency array
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<any | null>(null);

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
        
        // Suppress toast and badge increment if we are actively looking at the chat
        const isCurrentlyInChat =
          notification.type === "NEW_MESSAGE" &&
          pathnameRef.current === `/chat/${notification.metadata?.conversationId}`;

        if (!isCurrentlyInChat) {
          toast(notification.title || "New Notification", "info");
          setUnreadCount((prev) => prev + 1);
        }
        
        // Expose the raw notification object so pages can update their UI instantly
        setLatestNotification(notification);
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
    <NotificationsContext.Provider value={{ unreadCount, decrementUnread, markAllRead, latestNotification }}>
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
