"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/lib/validations";
import { Loader2, Plus, Trash2, Save, Rocket, AlertCircle } from "lucide-react";
import { TagInput } from "@/components/shared/tag-input";
import { Button } from "@/components/ui/button";

const TECH_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "Node.js", "Python", "FastAPI", "Django", "Java", "Spring",
  "Go", "Rust", "PostgreSQL", "MongoDB", "Redis", "Docker", "AWS", "Vercel", "Tailwind CSS",
];

export default function NewProjectPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectInput>({
    // @ts-expect-error type mismatch with Zod resolver
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      description: "",
      projectType: "Side Project",
      duration: "1-3 months",
      techStack: [],
      repoUrl: "",
      websiteUrl: "",
      isPublished: true,
      roles: [
        {
          title: "",
          description: "",
          requiredSkills: [],
          requiredExperienceLevel: "Any",
          timeCommitment: "Part-time (10-15h/week)",
          headcount: 1,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "roles",
  });

  const techStack = watch("techStack");

  const onSubmit = async (data: any) => {
    setStatus("submitting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create project");
      
      router.push(`/projects/${result.id}`);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Post a New Project</h1>
        <p className="text-muted-foreground mt-1">
          Share your idea and find the right teammates to bring it to life.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
        {/* Basic Details */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border shadow-sm">
          <h2 className="text-xl font-semibold">Project Details</h2>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <input
              {...register("title")}
              className="w-full h-11 px-4 rounded-xl border bg-transparent text-sm focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. AI Content Generator"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description *</label>
            <textarea
              {...register("description")}
              className="w-full h-32 px-4 py-3 rounded-xl border bg-transparent text-sm focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="What are you building? Why does it matter?"
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Type</label>
              <select
                {...register("projectType")}
                className="w-full h-11 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20"
              >
                {["Hackathon", "Startup", "Research", "Open Source", "Side Project", "Competition"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expected Duration</label>
              <select
                {...register("duration")}
                className="w-full h-11 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20"
              >
                {["< 1 week", "1-4 weeks", "1-3 months", "3-6 months", "6+ months"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tech Stack</label>
            <TagInput
              id="techStack"
              value={techStack || []}
              onChange={(tags) => setValue("techStack", tags, { shouldDirty: true })}
              placeholder="Add technologies..."
              suggestions={TECH_SUGGESTIONS}
              maxTags={20}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">GitHub / Repo URL (optional)</label>
              <input
                type="url"
                {...register("repoUrl")}
                className="w-full h-11 px-4 rounded-xl border bg-transparent text-sm focus:ring-2 focus:ring-primary/20"
                placeholder="https://github.com/..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Live Website (optional)</label>
              <input
                type="url"
                {...register("websiteUrl")}
                className="w-full h-11 px-4 rounded-xl border bg-transparent text-sm focus:ring-2 focus:ring-primary/20"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Open Roles</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ title: "", description: "", requiredSkills: [], requiredExperienceLevel: "Any", timeCommitment: "Part-time", headcount: 1 })}
              className="h-9 gap-1 text-xs"
            >
              <Plus className="w-3 h-3" /> Add Role
            </Button>
          </div>

          {errors.roles?.root && (
            <p className="text-sm text-destructive">{errors.roles.root.message as string}</p>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="relative bg-secondary/20 p-5 rounded-2xl border shadow-sm">
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                
                <h3 className="font-medium text-sm mb-4">Role #{index + 1}</h3>
                
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Role Title *</label>
                    <input
                      {...register(`roles.${index}.title` as const)}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. Frontend Dev"
                    />
                    {(errors.roles as any)?.[index]?.title && <p className="text-xs text-destructive">{(errors.roles as any)[index]?.title?.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Time Commitment</label>
                    <input
                      {...register(`roles.${index}.timeCommitment` as const)}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. 10hrs/week"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Experience Level</label>
                    <select
                      {...register(`roles.${index}.requiredExperienceLevel` as const)}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20"
                    >
                      {["Any", "Beginner", "Intermediate", "Advanced", "Expert"].map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Headcount</label>
                    <input
                      type="number"
                      min={1}
                      {...register(`roles.${index}.headcount` as const)}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Required Skills</label>
                  <TagInput
                    id={`roles.${index}.requiredSkills`}
                    value={watch(`roles.${index}.requiredSkills`) || []}
                    onChange={(tags) => setValue(`roles.${index}.requiredSkills`, tags, { shouldDirty: true })}
                    placeholder="e.g. React, UI Design..."
                    suggestions={TECH_SUGGESTIONS}
                    maxTags={10}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublished"
              {...register("isPublished")}
              className="rounded border-input text-primary focus:ring-primary/20"
            />
            <label htmlFor="isPublished" className="text-sm cursor-pointer">
              Publish immediately (uncheck to save as draft)
            </label>
          </div>
          
          <div className="flex items-center gap-4">
            {status === "error" && (
              <span className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {errorMessage}
              </span>
            )}
            <Button
              type="submit"
              disabled={status === "submitting"}
              className="brand-gradient text-white gap-2 shadow-sm min-w-32"
            >
              {status === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : watch("isPublished") ? (
                <><Rocket className="w-4 h-4" /> Post Project</>
              ) : (
                <><Save className="w-4 h-4" /> Save Draft</>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
