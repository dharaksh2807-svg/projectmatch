"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/lib/validations";
import { TagInput } from "@/components/shared/tag-input";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
} from "lucide-react";

const SKILL_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "Go", "Rust",
  "C++", "Swift", "Kotlin", "Figma", "UI/UX Design", "Product Design", "Graphic Design",
  "Machine Learning", "Data Science", "TensorFlow", "PyTorch", "SQL", "PostgreSQL", "MongoDB",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "DevOps", "Android", "iOS", "Flutter",
];

const PROJECT_TYPES = ["Hackathon", "Startup", "Research", "Open Source", "Side Project", "Competition"];
const DURATIONS = ["< 1 week", "1-4 weeks", "1-3 months", "3-6 months", "6+ months"];
const EXPERIENCE_LEVELS = ["Any", "Beginner", "Intermediate", "Advanced", "Expert"];
const TIME_COMMITMENTS = ["2-5 hrs/week", "5-10 hrs/week", "10-20 hrs/week", "20-30 hrs/week", "Full-time"];

export function ProjectForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<number | null>(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      description: "",
      projectType: "Side Project",
      duration: "1-3 months",
      roles: [
        {
          title: "",
          requiredSkills: [],
          requiredExperienceLevel: "Any",
          timeCommitment: "5-10 hrs/week",
          headcount: 1,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "roles",
  });

  const roles = watch("roles");

  const onSubmit = async (data: ProjectInput) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create project");
      }
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
      {/* Project Title */}
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">
          Project Title <span className="text-destructive">*</span>
        </label>
        <input
          id="title"
          {...register("title")}
          placeholder="e.g. AI-powered study companion app"
          className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description <span className="text-destructive">*</span>
        </label>
        <textarea
          id="description"
          {...register("description")}
          rows={5}
          placeholder="Describe your project — what problem it solves, what you're building, what stage you're at, and what kind of team you need..."
          className="w-full px-4 py-3 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Project Type & Duration */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="projectType" className="text-sm font-medium">
            Project Type <span className="text-destructive">*</span>
          </label>
          <select
            id="projectType"
            {...register("projectType")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="duration" className="text-sm font-medium">
            Duration <span className="text-destructive">*</span>
          </label>
          <select
            id="duration"
            {...register("duration")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Roles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Roles Needed</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define the skills and commitment required for each role.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              append({
                title: "",
                requiredSkills: [],
                requiredExperienceLevel: "Any",
                timeCommitment: "5-10 hrs/week",
                headcount: 1,
              });
              setExpandedRole(fields.length);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-accent transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Role
          </button>
        </div>

        {errors.roles?.root && (
          <p className="text-xs text-destructive">{errors.roles.root.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-2xl border border-border/50 glass-card overflow-hidden"
            >
              {/* Role Header */}
              <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setExpandedRole(expandedRole === index ? null : index)}
              >
                <div className="w-7 h-7 rounded-lg brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <span className="flex-1 text-sm font-medium">
                  {roles[index]?.title || `Role ${index + 1}`}
                </span>
                {roles[index]?.requiredSkills?.length > 0 && (
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {roles[index].requiredSkills.slice(0, 3).join(", ")}
                    {roles[index].requiredSkills.length > 3 && "..."}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(index);
                        setExpandedRole(null);
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {expandedRole === index ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Role Form */}
              {expandedRole === index && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
                  {/* Role Title */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Role Title <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...register(`roles.${index}.title`)}
                      placeholder="e.g. Frontend Developer, UX Designer..."
                      className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    {errors.roles?.[index]?.title && (
                      <p className="text-xs text-destructive">
                        {errors.roles[index]?.title?.message}
                      </p>
                    )}
                  </div>

                  {/* Required Skills */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Required Skills <span className="text-destructive">*</span>
                    </label>
                    <TagInput
                      value={roles[index]?.requiredSkills || []}
                      onChange={(tags) =>
                        setValue(`roles.${index}.requiredSkills`, tags, { shouldDirty: true })
                      }
                      suggestions={SKILL_SUGGESTIONS}
                      maxTags={20}
                      placeholder="e.g. React, TypeScript..."
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Experience Level */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Experience
                      </label>
                      <select
                        {...register(`roles.${index}.requiredExperienceLevel`)}
                        className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                      >
                        {EXPERIENCE_LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>

                    {/* Time Commitment */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Time/Week
                      </label>
                      <select
                        {...register(`roles.${index}.timeCommitment`)}
                        className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                      >
                        {TIME_COMMITMENTS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Headcount */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Headcount
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        {...register(`roles.${index}.headcount`)}
                        className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm focus:outline-none focus:border-primary/50 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        id="create-project"
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-2 px-8 py-3 rounded-xl brand-gradient text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 glow-sm"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating Project...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Create Project & Find Team
          </>
        )}
      </button>
    </form>
  );
}
