"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, ChevronDown, Sparkles } from "lucide-react";
import { RatingModal, Peer } from "@/components/ratings/rating-modal";
import { useToast } from "@/components/ui/toast-provider";

interface RateTeammatesSectionProps {
  projectId: string;
  projectTitle: string;
}

export function RateTeammatesSection({
  projectId,
  projectTitle,
}: RateTeammatesSectionProps) {
  const { toast } = useToast();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [allRated, setAllRated] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/ratings/pending");
      if (!res.ok) return;
      const data = await res.json();
      const entry = (data.pendingRatings as Array<{
        projectId: string;
        peers: Peer[];
      }>).find((p) => p.projectId === projectId);
      setPeers(entry?.peers ?? []);
      if (!entry || entry.peers.length === 0) setAllRated(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPending();
  }, [fetchPending]);

  if (loading) return null;
  if (allRated && peers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <Star className="w-3.5 h-3.5 fill-emerald-400" />
        You&apos;ve rated all teammates for this project — thank you!
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 text-violet-300 hover:from-violet-600/30 hover:to-indigo-600/30 hover:text-violet-200 transition-all group text-sm font-semibold"
      >
        <Star className="w-4 h-4 fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" />
        Rate Teammates
        <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {peers.length}
        </span>
        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
      </button>

      <RatingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        projectTitle={projectTitle}
        peers={peers}
        onAllRated={() => {
          setAllRated(true);
          setPeers([]);
          toast("All teammates rated! 🎉 Reputation scores updated.", "success");
        }}
      />
    </>
  );
}

// ─── Mark as Complete button (owner only) ─────────────────────────────────────

interface MarkCompleteButtonProps {
  projectId: string;
  currentStatus: string;
  onCompleted: () => void;
}

export function MarkCompleteButton({
  projectId,
  currentStatus,
  onCompleted,
}: MarkCompleteButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleMarkComplete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(
          "Project marked as completed! Team members can now rate each other.",
          "success"
        );
        onCompleted();
      } else {
        toast(data.error || "Failed to update project status.", "error");
      }
    } catch {
      toast("Network error.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus === "COMPLETED") return null;

  return (
    <button
      onClick={handleMarkComplete}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all text-xs font-semibold disabled:opacity-60"
    >
      <Sparkles className="w-3.5 h-3.5" />
      {loading ? "Saving…" : "Mark as Complete"}
    </button>
  );
}
