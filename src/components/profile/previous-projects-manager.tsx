"use client";

import { useState } from "react";
import type { PreviousProjectInput } from "@/lib/validations";
import { TagInput } from "@/components/shared/tag-input";
import {
  GoogleDriveIcon,
  GithubIcon,
  PdfIcon,
  PptIcon,
} from "@/components/shared/social-icons";
import {
  Plus,
  Trash2,
  Edit3,
  Globe,
  ExternalLink,
  FolderGit2,
  FileText,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DOCUMENT_TYPES = [
  "Presentation (PPT / Slides)",
  "Project Report (PDF)",
  "Research Paper (PDF)",
  "Pitch Deck / Slides",
  "Design Portfolio / Case Study",
  "Technical Documentation / Whitepaper",
  "Other Document",
];

const SKILL_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "Go", "Rust",
  "C++", "Swift", "Kotlin", "Figma", "Machine Learning", "Data Science", "PyTorch", "TensorFlow",
  "FastAPI", "SQL", "PostgreSQL", "MongoDB", "AWS", "GCP", "Docker", "Flutter", "Solidity",
];

interface PreviousProjectsManagerProps {
  projects: PreviousProjectInput[];
  onChange: (projects: PreviousProjectInput[]) => void;
}

export function PreviousProjectsManager({
  projects,
  onChange,
}: PreviousProjectsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [formState, setFormState] = useState<PreviousProjectInput>({
    title: "",
    description: "",
    techStack: [],
    projectUrl: "",
    githubUrl: "",
    driveUrl: "",
    fileType: "Presentation (PPT / Slides)",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const startAdding = () => {
    setFormState({
      title: "",
      description: "",
      techStack: [],
      projectUrl: "",
      githubUrl: "",
      driveUrl: "",
      fileType: "Presentation (PPT / Slides)",
    });
    setFormError(null);
    setEditingIndex(null);
    setIsAdding(true);
  };

  const startEditing = (index: number) => {
    const item = projects[index];
    setFormState({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      techStack: item.techStack || [],
      projectUrl: item.projectUrl || "",
      githubUrl: item.githubUrl || "",
      driveUrl: item.driveUrl || "",
      fileType: item.fileType || "Presentation (PPT / Slides)",
    });
    setFormError(null);
    setEditingIndex(index);
    setIsAdding(false);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setFormError(null);
  };

  const saveProject = () => {
    if (!formState.title.trim()) {
      setFormError("Project title is required.");
      return;
    }

    if (formState.projectUrl && !formState.projectUrl.startsWith("http")) {
      setFormError("Project link must start with http:// or https://");
      return;
    }
    if (formState.githubUrl && !formState.githubUrl.startsWith("http")) {
      setFormError("GitHub link must start with http:// or https://");
      return;
    }
    if (formState.driveUrl && !formState.driveUrl.startsWith("http")) {
      setFormError("Drive link must start with http:// or https://");
      return;
    }

    const cleanedItem: PreviousProjectInput = {
      id: formState.id,
      title: formState.title.trim(),
      description: formState.description?.trim() || "",
      techStack: formState.techStack || [],
      projectUrl: formState.projectUrl?.trim() || "",
      githubUrl: formState.githubUrl?.trim() || "",
      driveUrl: formState.driveUrl?.trim() || "",
      fileType: formState.fileType || "Presentation (PPT / Slides)",
    };

    if (editingIndex !== null) {
      const updated = [...projects];
      updated[editingIndex] = cleanedItem;
      onChange(updated);
    } else {
      onChange([cleanedItem, ...projects]);
    }

    cancelForm();
  };

  const deleteProject = (index: number) => {
    const updated = projects.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      cancelForm();
    }
  };

  const getDocBadge = (fileType?: string | null) => {
    const ft = (fileType || "").toLowerCase();
    if (ft.includes("ppt") || ft.includes("slide") || ft.includes("presentation") || ft.includes("deck")) {
      return {
        icon: <PptIcon className="w-3.5 h-3.5 text-amber-500" />,
        badgeClass: "border-amber-500/30 text-amber-500 bg-amber-500/10",
      };
    }
    if (ft.includes("pdf") || ft.includes("report") || ft.includes("paper")) {
      return {
        icon: <PdfIcon className="w-3.5 h-3.5 text-rose-500" />,
        badgeClass: "border-rose-500/30 text-rose-500 bg-rose-500/10",
      };
    }
    return {
      icon: <FileText className="w-3.5 h-3.5 text-blue-500" />,
      badgeClass: "border-blue-500/30 text-blue-500 bg-blue-500/10",
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/40">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-primary" />
            Previous Projects & Proof of Work
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add links of any previous projects you have done, or upload project presentations (PPT) and reports (PDF) through a Google Drive link.
          </p>
        </div>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={startAdding}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl brand-gradient text-white text-xs font-medium hover:opacity-90 transition-all glow-sm shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Project
          </button>
        )}
      </div>

      {/* Add / Edit Form Modal or Inline Card */}
      {(isAdding || editingIndex !== null) && (
        <div className="p-4 sm:p-5 rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-md shadow-lg space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-primary" />
              {editingIndex !== null ? "Edit Previous Project" : "Add Previous Project"}
            </h4>
            <button
              type="button"
              onClick={cancelForm}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Project Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formState.title}
              onChange={(e) => setFormState({ ...formState, title: e.target.value })}
              placeholder="e.g. AI-Powered Radiography Diagnosis or Smart Campus IoT"
              className="w-full h-10 px-3.5 rounded-xl border border-input bg-background/80 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Description / Summary (Optional)
            </label>
            <textarea
              rows={3}
              value={formState.description || ""}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              placeholder="Summarize what this project does, your contributions, key metrics or outcomes..."
              className="w-full p-3 rounded-xl border border-input bg-background/80 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          {/* Tech Stack */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Tech Stack & Skills Used
            </label>
            <TagInput
              value={formState.techStack || []}
              onChange={(tags) => setFormState({ ...formState, techStack: tags })}
              placeholder="e.g. React, PyTorch, Python, FastAPI..."
              suggestions={SKILL_SUGGESTIONS}
              maxTags={15}
            />
          </div>

          {/* Google Drive Link Section (Key user requirement) */}
          <div className="space-y-3 p-3.5 rounded-xl border border-primary/25 bg-primary/5">
            <div className="flex items-center gap-2">
              <GoogleDriveIcon className="w-4 h-4 text-primary shrink-0" />
              <div>
                <span className="text-xs font-semibold text-foreground">
                  Google Drive Link (PDF / PPT / Project Document)
                </span>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Upload your project presentation slides (PPT), capstone report (PDF), or research paper to Google Drive and paste the shareable link here. Make sure permissions are set to &quot;Anyone with the link can view&quot;.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-2.5 pt-1">
              <div className="sm:col-span-2">
                <input
                  type="url"
                  value={formState.driveUrl || ""}
                  onChange={(e) => setFormState({ ...formState, driveUrl: e.target.value })}
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <select
                  value={formState.fileType || "Presentation (PPT / Slides)"}
                  onChange={(e) => setFormState({ ...formState, fileType: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Other Links: Live Demo & GitHub */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" /> Project / Live Demo Link
              </label>
              <input
                type="url"
                value={formState.projectUrl || ""}
                onChange={(e) => setFormState({ ...formState, projectUrl: e.target.value })}
                placeholder="https://myproject.com or demo video link"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <GithubIcon className="w-3.5 h-3.5 text-foreground/80" /> GitHub / Source Code Link
              </label>
              <input
                type="url"
                value={formState.githubUrl || ""}
                onChange={(e) => setFormState({ ...formState, githubUrl: e.target.value })}
                placeholder="https://github.com/username/project"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={cancelForm}
              className="px-3.5 py-1.5 rounded-lg border border-input text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveProject}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg brand-gradient text-white text-xs font-medium hover:opacity-90 transition-opacity glow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {editingIndex !== null ? "Update Project" : "Add to Profile"}
            </button>
          </div>
        </div>
      )}

      {/* Projects List */}
      {projects.length === 0 && !isAdding && (
        <div className="p-6 rounded-2xl border border-dashed border-border/60 bg-muted/10 text-center space-y-2">
          <FolderGit2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">
            No previous projects added yet.
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Adding previous projects and uploading your reports (PDF) or presentations (PPT) via Google Drive dramatically increases your chances of getting accepted into top project teams.
          </p>
          <button
            type="button"
            onClick={startAdding}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors mt-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Your First Previous Project
          </button>
        </div>
      )}

      {projects.length > 0 && (
        <div className="grid gap-3">
          {projects.map((proj, idx) => {
            const docBadge = getDocBadge(proj.fileType);
            return (
              <div
                key={proj.id || idx}
                className="p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-all space-y-3 relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {proj.title}
                      </h4>
                      {proj.driveUrl && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${docBadge.badgeClass}`}
                        >
                          {docBadge.icon}
                          {proj.fileType || "Project Document"}
                        </Badge>
                      )}
                    </div>
                    {proj.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                  </div>

                  {/* Edit / Delete actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditing(idx)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit project"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(idx)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tech Stack Pills */}
                {proj.techStack && proj.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {proj.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick Link Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
                  {proj.driveUrl && (
                    <a
                      href={proj.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20"
                    >
                      <GoogleDriveIcon className="w-3.5 h-3.5 text-primary" />
                      View Project File / Slides
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}

                  {proj.projectUrl && (
                    <a
                      href={proj.projectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/40 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      Live Demo
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  )}

                  {proj.githubUrl && (
                    <a
                      href={proj.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/40 transition-colors"
                    >
                      <GithubIcon className="w-3.5 h-3.5" />
                      GitHub Repo
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
