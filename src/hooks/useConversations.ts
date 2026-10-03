"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DirectConversation } from "@/types";
import { useToast } from "@/components/ui/toast-provider";

export function useConversations() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        setError(null);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to load conversations");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (session?.user?.id && !ignore) {
        await fetchConversations();
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [session?.user?.id, fetchConversations]);

  const startConversation = async (userId: string, projectId?: string) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchConversations();
        return { success: true, conversation: data };
      } else {
        toast(data.error || "Could not open conversation", "error");
        return { success: false, error: data.error };
      }
    } catch {
      toast("Error creating conversation", "error");
      return { success: false, error: "Network error" };
    }
  };

  return {
    conversations,
    setConversations,
    loading,
    error,
    refresh: fetchConversations,
    startConversation,
  };
}
