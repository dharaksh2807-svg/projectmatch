"use client";

import { useState, useCallback } from "react";
import { AIMatchRoleResult } from "@/types";
import { useToast } from "@/components/ui/toast-provider";

export function useAIMatches() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<AIMatchRoleResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/matches/ai");
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        setHasLoaded(true);
        toast("AI recommendations computed!", "success");
      } else {
        toast("Could not fetch AI matches", "error");
      }
    } catch {
      toast("Error connecting to AI matchmaker", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    matches,
    loading,
    hasLoaded,
    fetchMatches,
  };
}
