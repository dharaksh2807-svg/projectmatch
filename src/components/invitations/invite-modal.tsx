"use client";

import { useState } from "react";
import {
  Users,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

interface RoleOption {
  id: string;
  title: string;
  isOpen: boolean;
  filledCount: number;
  headcount: number;
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  roles: RoleOption[];
  defaultRoleId?: string | null;
  onSuccess?: () => void;
}

export function InviteModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  roles,
  defaultRoleId,
  onSuccess,
}: InviteModalProps) {
  const { toast } = useToast();

  const [selectedRoleId, setSelectedRoleId] = useState<string>(defaultRoleId || "");
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId || undefined,
          expiresInDays: Number(expiresInDays),
          maxUses: Number(maxUses),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Failed to generate invitation", "error");
        setSubmitting(false);
        return;
      }

      setGeneratedLink(data.url);

      // Save token in sessionStorage so the owner can copy it from the table during this session
      if (typeof window !== "undefined" && data.invitation?.id && data.url) {
        sessionStorage.setItem(`pm_invite_${data.invitation.id}`, data.url);
      }

      toast("Invitation link generated!", "success");
      onSuccess?.();
    } catch (err) {
      console.error("Failed to generate invite:", err);
      toast("An error occurred while generating the invitation", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast("Link copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetAndClose = () => {
    setGeneratedLink(null);
    setCopied(false);
    onClose();
  };

  const openRoles = roles.filter((r) => r.isOpen && r.filledCount < r.headcount);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Invite Teammate
              </h2>
              <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-sm">
                {projectTitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {generatedLink ? (
            /* Generated Link Display */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div className="text-xs">
                  <span className="font-semibold text-sm">
                    Invitation link created!
                  </span>
                  <p className="mt-0.5 opacity-90">
                    Anyone with this link can view the project and accept to join as a teammate.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Shareable Link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedLink}
                    className="font-mono text-xs bg-secondary/50 select-all"
                  />
                  <Button
                    onClick={handleCopy}
                    className="shrink-0 gap-1.5 brand-gradient text-white"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy Link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2">
                <p>• Expires in {expiresInDays} day{expiresInDays !== 1 ? "s" : ""}</p>
                <p>• Maximum successful uses: {maxUses}</p>
                <p>
                  • Target role:{" "}
                  {selectedRoleId
                    ? roles.find((r) => r.id === selectedRoleId)?.title || "Selected role"
                    : "Any open role"}
                </p>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <Button onClick={handleResetAndClose} variant="outline" size="sm">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <div className="space-y-4">
              {/* Role selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Target Role (Optional)</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {openRoles.length} open role{openRoles.length !== 1 ? "s" : ""}
                  </span>
                </label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                >
                  <option value="">Any open role (Candidate chooses)</option>
                  {openRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title} ({role.headcount - role.filledCount} spot left)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  If selected, the recipient joins this specific role directly.
                </p>
              </div>

              {/* Expiration selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    Expiration Period
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                  >
                    <option value={1}>1 Day</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days (Default)</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    Max Uses
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={maxUses}
                    onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-xs h-10"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  The invitation link acts as a secure bearer credential. For security, only a cryptographic hash is stored on the server.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="brand-gradient text-white gap-1.5 font-semibold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-3.5 h-3.5" /> Generate Invite Link
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
