"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast-provider";

export interface ReceivedApplicantItem {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    skills: string[];
    experienceLevel: string | null;
    bio: string | null;
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    twitterHandle: string | null;
    reputationScore: number;
  };
  role: {
    id: string;
    title: string;
    requiredSkills: string[];
    timeCommitment: string;
    requiredExperienceLevel: string;
    headcount: number;
    filledCount: number;
    isOpen: boolean;
  };
  project: {
    id: string;
    title: string;
    projectType: string;
    ownerId: string;
  };
}

export function useApplicants() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [applicants, setApplicants] = useState<ReceivedApplicantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<Set<string>>(new Set());

  const fetchApplicants = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const res = await fetch("/api/applications?type=received");
      if (res.ok) {
        const data = await res.json();
        setApplicants(data || []);
      }
    } catch (err) {
      console.error("Failed to load applicants:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  const updateStatus = async (
    applicationId: string,
    status: "ACCEPTED" | "REJECTED"
  ) => {
    setActingOn((prev) => new Set(prev).add(applicationId));
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(
          status === "ACCEPTED"
            ? "Applicant accepted! Conversation opened."
            : "Applicant rejected.",
          status === "ACCEPTED" ? "success" : "info"
        );
        setApplicants((prev) =>
          prev.map((app) =>
            app.id === applicationId ? { ...app, status } : app
          )
        );
        return { success: true };
      } else {
        toast(data.error || "Action failed", "error");
        return { success: false, error: data.error };
      }
    } catch {
      toast("Network error updating application", "error");
      return { success: false, error: "Network error" };
    } finally {
      setActingOn((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    }
  };

  const metrics = useMemo(() => {
    const total = applicants.length;
    const pending = applicants.filter((a) => a.status === "PENDING").length;
    const accepted = applicants.filter((a) => a.status === "ACCEPTED").length;
    const rejected = applicants.filter((a) => a.status === "REJECTED").length;
    return { total, pending, accepted, rejected };
  }, [applicants]);

  return {
    applicants,
    loading,
    actingOn,
    metrics,
    refresh: fetchApplicants,
    acceptApplicant: (id: string) => updateStatus(id, "ACCEPTED"),
    rejectApplicant: (id: string) => updateStatus(id, "REJECTED"),
  };
}
