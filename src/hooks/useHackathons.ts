"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Hackathon } from "@/types";
import { useToast } from "@/components/ui/toast-provider";

export function useHackathons() {
  const { toast } = useToast();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");

  const fetchHackathons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hackathons");
      if (res.ok) {
        const data = await res.json();
        setHackathons(data);
      } else {
        toast("Failed to load hackathons", "error");
      }
    } catch {
      toast("Network error loading hackathons", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHackathons();
  }, [fetchHackathons]);

  const filtered = useMemo(() => {
    return hackathons.filter((h) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        h.name.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q)) ||
        (h.location && h.location.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (category === "Virtual") {
        return (
          h.location?.toLowerCase().includes("virtual") ||
          h.location?.toLowerCase().includes("online")
        );
      }
      if (category === "In-Person") {
        return (
          h.location &&
          !h.location.toLowerCase().includes("virtual") &&
          !h.location.toLowerCase().includes("online")
        );
      }
      if (category === "AI & ML") {
        return (
          h.name.toLowerCase().includes("ai") ||
          h.name.toLowerCase().includes("genai") ||
          (h.description && h.description.toLowerCase().includes("ai"))
        );
      }
      if (category === "Web3") {
        return (
          h.name.toLowerCase().includes("eth") ||
          h.name.toLowerCase().includes("crypto") ||
          (h.description && h.description.toLowerCase().includes("decentralized"))
        );
      }

      return true;
    });
  }, [hackathons, searchQuery, category]);

  return {
    hackathons: filtered,
    allHackathons: hackathons,
    loading,
    searchQuery,
    setSearchQuery,
    category,
    setCategory,
    refresh: fetchHackathons,
  };
}
