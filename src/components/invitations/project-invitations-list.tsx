"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Link as LinkIcon,
  Copy,
  Check,
  Ban,
  Clock,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { InviteModal } from "./invite-modal";

interface InvitationItem {
  id: string;
  projectId: string;
  roleId: string | null;
  roleTitle: string | null;
  expiresAt: string;
  maxUses: number;
  usesCount: number;
  isRevoked: boolean;
  revokedAt: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "EXHAUSTED";
  createdAt: string;
  redemptions?: Array<{
    id: string;
    redeemedAt: string;
    user: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }>;
}

interface ProjectInvitationsListProps {
  projectId: string;
  projectTitle: string;
  roles: Array<{
    id: string;
    title: string;
    isOpen: boolean;
    filledCount: number;
    headcount: number;
  }>;
}

export function ProjectInvitationsList({
  projectId,
  projectTitle,
  roles,
}: ProjectInvitationsListProps) {
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Failed to load invitations:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/invitations/${invitationId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        toast("Failed to revoke invitation", "error");
        return;
      }
      toast("Invitation revoked", "info");
      loadInvitations();
    } catch (err) {
      console.error("Revoke failed:", err);
      toast("Error revoking invitation", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = (invitationId: string) => {
    // Check if the bearer link was preserved in sessionStorage during creation
    const storedUrl =
      typeof window !== "undefined"
        ? sessionStorage.getItem(`pm_invite_${invitationId}`)
        : null;

    if (storedUrl) {
      navigator.clipboard.writeText(storedUrl);
      setCopiedId(invitationId);
      toast("Invitation link copied to clipboard!", "success");
      setTimeout(() => setCopiedId(null), 2500);
      return;
    }

    // In compliance with cryptographic bearer token security,
    // the raw token is only held in memory/session and never stored unhashed in DB.
    toast(
      "Link created in another session. For security, create a new link if needed.",
      "info"
    );
  };

  const getStatusBadge = (inv: InvitationItem) => {
    switch (inv.status) {
      case "ACTIVE":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
          >
            Active
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]"
          >
            Expired
          </Badge>
        );
      case "REVOKED":
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]"
          >
            Revoked
          </Badge>
        );
      case "EXHAUSTED":
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border text-[10px]"
          >
            Limit Reached
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border/60 bg-card shadow-xs">
      <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-primary" /> Team Invitation Links
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share secure links to directly invite collaborators into specific roles.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          className="brand-gradient text-white font-semibold text-xs gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Invite Teammate
        </Button>
      </CardHeader>

      <CardContent className="p-5 pt-2">
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              No invitation links generated yet.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="mt-3 text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Generate First Invite
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop & Mobile Card/Table View */}
            <div className="divide-y divide-border/60 border border-border/60 rounded-xl overflow-hidden">
              {invitations.map((inv) => {
                const isActive = inv.status === "ACTIVE";
                const isCopied = copiedId === inv.id;
                const isRevoking = revokingId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {inv.roleTitle || "Any open role"}
                        </span>
                        {getStatusBadge(inv)}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {isActive
                            ? `Expires ${formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}`
                            : `Created ${format(new Date(inv.createdAt), "MMM d, yyyy")}`}
                        </span>

                        <span>
                          Uses:{" "}
                          <strong className="text-foreground font-medium">
                            {inv.usesCount}
                          </strong>{" "}
                          / {inv.maxUses}
                        </span>

                        {inv.redemptions && inv.redemptions.length > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Joined: {inv.redemptions.map((r) => r.user.name).filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(inv.id)}
                          className="text-xs h-8 gap-1.5 cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy Link
                            </>
                          )}
                        </Button>
                      )}

                      {isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={isRevoking}
                          className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        >
                          {isRevoking ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" /> Revoke
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <InviteModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        projectTitle={projectTitle}
        roles={roles}
        onSuccess={() => {
          loadInvitations();
        }}
      />
    </Card>
  );
}
