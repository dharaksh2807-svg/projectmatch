"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-provider";
import { GoogleDriveIcon, PdfIcon, PptIcon } from "@/components/shared/social-icons";
import {
  Send,
  Loader2,
  Globe,
  FolderGit2,
  Info,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface PreviousProjectItem {
  id: string;
  title: string;
  description?: string | null;
  techStack?: string[];
  projectUrl?: string | null;
  githubUrl?: string | null;
  driveUrl?: string | null;
  fileType?: string | null;
}

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: {
    id: string;
    title: string;
    requiredSkills?: string[];
    timeCommitment?: string;
  } | null;
  projectId: string;
  projectTitle: string;
  onSuccess?: () => void;
}

export function ApplyModal({
  isOpen,
  onClose,
  role,
  projectId: _projectId,
  projectTitle,
  onSuccess,
}: ApplyModalProps) {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [message, setMessage] = useState(
    "Hi! I'm interested in this role and would love to contribute to the project."
  );
  const [projectUrl, setProjectUrl] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [selectedPrevProjectId, setSelectedPrevProjectId] = useState<string | null>(null);

  const [previousProjects, setPreviousProjects] = useState<PreviousProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch candidate's previous projects when modal opens
  useEffect(() => {
    if (isOpen && sessionStatus === "authenticated") {
      setLoadingProjects(true);
      fetch("/api/profile/previous-projects")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            setPreviousProjects(data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingProjects(false));
    }
  }, [isOpen, sessionStatus]);

  // Reset or initialize state when opening
  useEffect(() => {
    if (isOpen) {
      setMessage("Hi! I'm interested in this role and would love to contribute to the project.");
      setProjectUrl("");
      setDriveUrl("");
      setSelectedPrevProjectId(null);
    }
  }, [isOpen]);

  const handleSelectPreviousProject = (proj: PreviousProjectItem) => {
    if (selectedPrevProjectId === proj.id) {
      // Toggle off
      setSelectedPrevProjectId(null);
      setProjectUrl("");
      setDriveUrl("");
      return;
    }

    setSelectedPrevProjectId(proj.id);
    if (proj.projectUrl || proj.githubUrl) {
      setProjectUrl(proj.projectUrl || proj.githubUrl || "");
    }
    if (proj.driveUrl) {
      setDriveUrl(proj.driveUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sessionStatus !== "authenticated") {
      toast("Please sign in to apply.", "info");
      router.push("/login");
      return;
    }

    if (!role?.id) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: role.id,
          message: message.trim(),
          projectUrl: projectUrl.trim() || undefined,
          driveUrl: driveUrl.trim() || undefined,
        }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned a non-JSON response");
      }

      const data = await res.json();

      if (res.ok || res.status === 201) {
        toast(`Application submitted for "${role.title}"! 🎉`, "success");
        onSuccess?.();
        onClose();
      } else if (res.status === 409) {
        toast(data.error || "You have already applied to this role.", "info");
        onClose();
      } else if (res.status === 429) {
        toast("Too many applications. Please wait a moment before trying again.", "error");
      } else {
        toast(data.error || "Failed to submit application.", "error");
      }
    } catch (err: any) {
      toast(err.message || "Failed to submit application. Please check your network.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!role) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border-border/70 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-border/40 bg-muted/20">
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                Applying for Role
              </Badge>
              {role.timeCommitment && (
                <span className="text-xs text-muted-foreground">{role.timeCommitment}</span>
              )}
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight mt-1">
              {role.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              in <span className="font-medium text-foreground">{projectTitle}</span>
            </DialogDescription>
          </DialogHeader>

          {role.requiredSkills && role.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {role.requiredSkills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Form Body - scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Cover Message */}
          <div className="space-y-1.5">
            <label htmlFor="cover-message" className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">
              Cover Note & Introduction
            </label>
            <textarea
              id="cover-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Introduce yourself, your relevant skills, and why you'd be a great fit for this role..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
            />
          </div>

          {/* Proof of Work / Previous Projects Showcase */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Proof of Work & Project Attachments
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Attach previous project demos, slide decks (PPT), or PDF reports to stand out to the project lead.
                </p>
              </div>
            </div>

            {/* Quick Picker from user's saved previous projects */}
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your profile projects...
              </div>
            ) : previousProjects.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-foreground/80 flex items-center gap-1">
                  <FolderGit2 className="w-3 h-3 text-primary" />
                  Quick-attach from your saved profile projects:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                  {previousProjects.map((proj) => {
                    const isSelected = selectedPrevProjectId === proj.id;
                    return (
                      <button
                        type="button"
                        key={proj.id}
                        onClick={() => handleSelectPreviousProject(proj)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                            : "bg-background hover:bg-muted/80 text-foreground border-border/80"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        {proj.fileType?.includes("PPT") ? (
                          <PptIcon className="w-3 h-3" />
                        ) : proj.fileType?.includes("PDF") ? (
                          <PdfIcon className="w-3 h-3" />
                        ) : proj.driveUrl ? (
                          <GoogleDriveIcon className="w-3 h-3" />
                        ) : (
                          <Globe className="w-3 h-3 opacity-60" />
                        )}
                        <span className="truncate max-w-[160px]">{proj.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Have completed projects? You can paste links directly below.</span>
              </div>
            )}

            {/* Live Demo or Github URL */}
            <div className="space-y-1">
              <label htmlFor="modal-project-url" className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                Live Demo / GitHub Repository URL (optional)
              </label>
              <input
                id="modal-project-url"
                type="url"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://myproject.vercel.app or https://github.com/..."
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Google Drive Link (PDF / PPT / Slides / Paper) */}
            <div className="space-y-1">
              <label htmlFor="modal-drive-url" className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                <GoogleDriveIcon className="w-3.5 h-3.5 text-blue-500" />
                Project File / Slides (Google Drive link for PPT / PDF)
              </label>
              <input
                id="modal-drive-url"
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/... or slide deck link"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
                <Info className="w-3 h-3 flex-shrink-0 text-blue-500" />
                Supports presentation slides (PPT), project PDF reports, or research papers. Set Drive link sharing to <strong>&ldquo;Anyone with the link can view&rdquo;</strong>.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="brand-gradient text-white text-xs h-9 gap-1.5 font-medium px-4"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit Application
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
