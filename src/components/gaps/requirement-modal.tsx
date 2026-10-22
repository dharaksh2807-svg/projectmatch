"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Sparkles, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { ProjectCapabilityItem } from "@/lib/gap-analyzer";

interface RequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  requirement?: ProjectCapabilityItem | null; // if present, editing mode
  onSuccess: () => void;
}

export function RequirementModal({
  isOpen,
  onClose,
  projectId,
  requirement,
  onSuccess,
}: RequirementModalProps) {
  const { toast } = useToast();

  const isEditing = !!requirement && requirement.isCustom;
  const isDerived = !!requirement && !requirement.isCustom;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("ENGINEERING");
  const [importance, setImportance] = useState<"REQUIRED" | "PREFERRED">("REQUIRED");
  const [skillsInput, setSkillsInput] = useState("");
  const [minExp, setMinExp] = useState("Intermediate");
  const [targetRole, setTargetRole] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (requirement) {
      setName(requirement.name);
      setCategory(requirement.category || "ENGINEERING");
      setImportance(requirement.importance);
      setSkillsInput(requirement.requiredSkills.join(", "));
      setMinExp(requirement.minExperienceLevel || "Any");
      setTargetRole(requirement.targetRoleTitle || "");
      setDescription(requirement.description || "");
    } else {
      setName("");
      setCategory("ENGINEERING");
      setImportance("REQUIRED");
      setSkillsInput("");
      setMinExp("Intermediate");
      setTargetRole("");
      setDescription("");
    }
  }, [requirement, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Please provide a capability name.", "error");
      return;
    }

    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (skills.length === 0) {
      toast("Please specify at least one required skill.", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        importance,
        requiredSkills: skills,
        minExperienceLevel: minExp === "Any" ? null : minExp,
        targetRoleTitle: targetRole.trim() || null,
        description: description.trim() || null,
      };

      let url = `/api/projects/${projectId}/requirements`;
      let method = "POST";

      if (isEditing && requirement?.id) {
        url = `/api/projects/${projectId}/requirements/${requirement.id}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to save requirement");
      }

      toast(
        isEditing
          ? "Requirement updated successfully."
          : "Capability requirement added successfully.",
        "success"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to save requirement", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!requirement?.id || !isEditing) return;
    if (!confirm("Are you sure you want to remove this capability requirement?")) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/requirements/${requirement.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete requirement");
      }

      toast("Requirement removed successfully.", "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to delete requirement", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-xl p-5 sm:p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {isEditing
                  ? "Edit Capability Requirement"
                  : isDerived
                  ? "Customize Derived Requirement"
                  : "Add Project Capability Requirement"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Define the specific skills and seniority your project team requires.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Capability Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI/ML Integration, Frontend Development, DevOps"
              required
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Importance Level
              </label>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value as "REQUIRED" | "PREFERRED")}
                className="w-full text-xs sm:text-sm bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
              >
                <option value="REQUIRED">Required (Must have)</option>
                <option value="PREFERRED">Preferred (Nice to have)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs sm:text-sm bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
              >
                <option value="ENGINEERING">Engineering</option>
                <option value="AI_ML">AI / Machine Learning</option>
                <option value="DESIGN">UI / UX Design</option>
                <option value="DEVOPS">DevOps & Cloud</option>
                <option value="PRODUCT">Product & Pitching</option>
                <option value="GENERAL">General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Required Skills (comma-separated) <span className="text-destructive">*</span>
            </label>
            <Input
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g. Python, PyTorch, LangChain, FastAPI"
              required
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Enter specific technologies or skills. The analyzer checks team profiles against these.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Min. Experience Level
              </label>
              <select
                value={minExp}
                onChange={(e) => setMinExp(e.target.value)}
                className="w-full text-xs sm:text-sm bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
              >
                <option value="Any">Any Level Accepted</option>
                <option value="Beginner">Beginner or higher</option>
                <option value="Intermediate">Intermediate or higher</option>
                <option value="Advanced">Advanced / Senior</option>
                <option value="Expert">Expert / Lead</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Target Role Title (optional)
              </label>
              <Input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. AI Engineer"
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Description or Context (optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Responsible for model fine-tuning and inference API"
              className="text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
            {isEditing ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || loading}
                className="gap-1 cursor-pointer"
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading || deleting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || deleting}
                className="brand-gradient text-white gap-1 min-w-[90px] cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save Requirement
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
