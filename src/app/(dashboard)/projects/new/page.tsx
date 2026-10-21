"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/lib/validations";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Rocket,
  AlertCircle,
} from "lucide-react";
import { TagInput } from "@/components/shared/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoogleDriveIcon } from "@/components/shared/social-icons";

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
    formState: { errors, isDirty },
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
      driveUrl: "",
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

  // Protection against accidental loss of unsaved work
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && status !== "submitting") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, status]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "roles",
  });

  const techStack = watch("techStack");
  const formValues = watch();

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
    <div className="min-h-screen bg-background p-3.5 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in min-w-0 overflow-x-hidden font-sans">
      <div className="pb-3 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Create & Post a Project
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Tell prospective teammates about your project vision, target tech stack, and open vacancies.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
        {/* ── SECTION 1: PROJECT BASICS ── */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  Project Basics
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Give your project an identifiable title, category, and core technologies.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="project-title" className="text-xs font-semibold text-foreground block">
                Project Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="project-title"
                {...register("title")}
                placeholder="e.g. SRM Campus Marketplace, Autonomous Quadcopter AI"
                className="bg-background text-sm"
              />
              <p className="text-[11px] text-muted-foreground">A concise, descriptive name (3-100 characters).</p>
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="project-type" className="text-xs font-semibold text-foreground block">
                  Project Type
                </label>
                <select
                  id="project-type"
                  {...register("projectType")}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  {["Hackathon", "Startup", "Research", "Open Source", "Side Project", "Competition"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">Helps teammates filter by intent and timeline.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Primary Tech Stack
                </label>
                <TagInput
                  id="techStack"
                  value={techStack || []}
                  onChange={(tags) => setValue("techStack", tags, { shouldDirty: true })}
                  placeholder="e.g. Next.js, PyTorch, Supabase..."
                  suggestions={TECH_SUGGESTIONS}
                  maxTags={15}
                />
                <p className="text-[11px] text-muted-foreground">Core frameworks, languages, or tools.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 2: GOALS & DESCRIPTION ── */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  Goals & Description
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Detail what you are building, the problem being solved, and relevant links.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="project-desc" className="text-xs font-semibold text-foreground block">
                Detailed Description <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="project-desc"
                {...register("description")}
                rows={4}
                placeholder="What is the objective of this project? What stage is it at (ideation, prototype, active development)? What will teammates learn or achieve?"
                className="bg-background text-sm resize-none"
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="grid sm:grid-cols-3 gap-4 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="repo-url" className="text-xs font-semibold text-foreground block">
                  Code Repository (optional)
                </label>
                <Input
                  id="repo-url"
                  type="url"
                  {...register("repoUrl")}
                  placeholder="https://github.com/..."
                  className="bg-background text-xs"
                />
                {errors.repoUrl && <p className="text-xs text-destructive">{errors.repoUrl.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="website-url" className="text-xs font-semibold text-foreground block">
                  Live Preview / Demo (optional)
                </label>
                <Input
                  id="website-url"
                  type="url"
                  {...register("websiteUrl")}
                  placeholder="https://..."
                  className="bg-background text-xs"
                />
                {errors.websiteUrl && <p className="text-xs text-destructive">{errors.websiteUrl.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="drive-url" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <GoogleDriveIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>Specs or Slides (optional)</span>
                </label>
                <Input
                  id="drive-url"
                  type="url"
                  {...register("driveUrl")}
                  placeholder="https://drive.google.com/..."
                  className="bg-background text-xs"
                />
                {errors.driveUrl && <p className="text-xs text-destructive">{errors.driveUrl.message}</p>}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 For Google Drive links, verify permissions are set to &ldquo;Anyone with link can view&rdquo;.
            </p>
          </CardContent>
        </Card>

        {/* ── SECTION 3: OPEN ROLES & SKILLS ── */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-border flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  Open Roles & Skills
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  List specific roles you need to fill and required skills for each.
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ title: "", description: "", requiredSkills: [], requiredExperienceLevel: "Any", timeCommitment: "Part-time (10-15h/week)", headcount: 1 })}
              className="h-8.5 gap-1.5 text-xs font-medium border-border"
            >
              <Plus className="w-3.5 h-3.5" /> Add Role
            </Button>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4">
            {errors.roles?.root && (
              <p className="text-xs text-destructive">{errors.roles.root.message as string}</p>
            )}

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="relative bg-secondary/30 p-4 sm:p-5 rounded-2xl border border-border">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="absolute top-4 right-4 text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label={`Remove role ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="purple" className="text-[10px]">
                      Role #{index + 1}
                    </Badge>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground block">
                        Role Title <span className="text-destructive">*</span>
                      </label>
                      <Input
                        {...register(`roles.${index}.title` as const)}
                        placeholder="e.g. Frontend Engineer, UI/UX Designer, ML Researcher"
                        className="bg-background text-xs"
                      />
                      {(errors.roles as any)?.[index]?.title && (
                        <p className="text-xs text-destructive">{(errors.roles as any)[index]?.title?.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground block">
                        Experience Level
                      </label>
                      <select
                        {...register(`roles.${index}.requiredExperienceLevel` as const)}
                        className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-ring focus:outline-none"
                      >
                        {["Any", "Beginner", "Intermediate", "Advanced", "Expert"].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground block">
                        Spots Needed (Headcount)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        {...register(`roles.${index}.headcount` as const, { valueAsNumber: true })}
                        className="bg-background text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground block">
                        Role Time Commitment
                      </label>
                      <Input
                        {...register(`roles.${index}.timeCommitment` as const)}
                        placeholder="e.g. 10-15 hrs/week, Weekend sprints"
                        className="bg-background text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground block">
                      Required Skills & proficiencies
                    </label>
                    <TagInput
                      id={`roles.${index}.requiredSkills`}
                      value={watch(`roles.${index}.requiredSkills`) || []}
                      onChange={(tags) => setValue(`roles.${index}.requiredSkills`, tags, { shouldDirty: true })}
                      placeholder="e.g. TailwindCSS, Figma, PyTorch (press enter to add)"
                      suggestions={TECH_SUGGESTIONS}
                      maxTags={10}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 4: AVAILABILITY & DURATION ── */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                4
              </span>
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  Availability, Duration & Expectations
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Establish a clear timeline to set upfront expectations for all applicants.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="space-y-1.5 max-w-sm">
              <label htmlFor="duration-select" className="text-xs font-semibold text-foreground block">
                Estimated Project Lifespan
              </label>
              <select
                id="duration-select"
                {...register("duration")}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-ring focus:outline-none"
              >
                {["< 1 week", "1-4 weeks", "1-3 months", "3-6 months", "6+ months"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Transparent project duration and workload benchmarks reduce drop-off rates and ensure team accountability during critical milestones.
            </p>
          </CardContent>
        </Card>

        {/* ── SECTION 5: REVIEW & PUBLISH ── */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                5
              </span>
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  Review & Publish
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Finalize listing visibility and post your project.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border">
              <input
                type="checkbox"
                id="isPublished"
                {...register("isPublished")}
                className="mt-0.5 rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <label htmlFor="isPublished" className="text-xs cursor-pointer select-none">
                <span className="font-semibold text-foreground block">
                  Publish immediately to ProjectMatch Discover
                </span>
                <span className="text-muted-foreground">
                  When enabled, qualified members will see this vacancy immediately and can apply. Uncheck to keep it in Draft mode.
                </span>
              </label>
            </div>

            {status === "error" && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                {fields.length} open {fields.length === 1 ? "role" : "roles"} defined • {formValues.title ? formValues.title : "Untitled project"}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/projects")}
                  className="text-xs border-border"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={status === "submitting"}
                  className="text-xs font-semibold min-w-36 gap-2"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Project...</span>
                    </>
                  ) : watch("isPublished") ? (
                    <>
                      <Rocket className="w-3.5 h-3.5" />
                      <span>Publish Project</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save as Draft</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
