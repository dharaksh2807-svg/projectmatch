"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations";
import { TagInput } from "@/components/shared/tag-input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  CheckCircle2,
  AlertCircle,
  Globe,
  User,
  Sparkles,
  Briefcase,
  Link2,
  FolderGit2,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  GithubIcon,
  LinkedinIcon,
  LeetCodeIcon,
  CodeforcesIcon,
  HackerRankIcon,
  KaggleIcon,
  GoogleDriveIcon,
} from "@/components/shared/social-icons";
import { PreviousProjectsManager } from "@/components/profile/previous-projects-manager";

const SKILL_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "Go", "Rust",
  "C++", "Swift", "Kotlin", "Figma", "UI/UX Design", "Product Design", "Graphic Design",
  "Machine Learning", "Data Science", "TensorFlow", "PyTorch", "SQL", "PostgreSQL", "MongoDB",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "DevOps", "CI/CD", "Android", "iOS",
  "Flutter", "React Native", "Web3", "Solidity", "Blockchain", "Game Dev", "Unity",
];

const TIMEZONES = [
  "UTC", "UTC-12:00 (Baker Island)", "UTC-11:00 (American Samoa)", "UTC-10:00 (Hawaii)",
  "UTC-8:00 (PT)", "UTC-7:00 (MT)", "UTC-6:00 (CT)", "UTC-5:00 (ET)",
  "UTC-4:00 (Atlantic)", "UTC-3:00 (Buenos Aires)", "UTC-1:00 (Azores)",
  "UTC+0:00 (London)", "UTC+1:00 (CET)", "UTC+2:00 (EET)", "UTC+3:00 (Moscow)",
  "UTC+4:00 (Dubai)", "UTC+5:00 (PKT)", "UTC+5:30 (IST)", "UTC+6:00 (BST)",
  "UTC+7:00 (ICT)", "UTC+8:00 (SGT)", "UTC+9:00 (JST)", "UTC+10:00 (AEST)",
  "UTC+12:00 (NZST)",
];

interface ProfileFormProps {
  initialData?: Partial<ProfileInput>;
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    // @ts-expect-error type mismatch with Zod resolver
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData?.name || "",
      bio: initialData?.bio || "",
      skills: initialData?.skills || [],
      availability: initialData?.availability || null,
      timezone: initialData?.timezone || "UTC+5:30 (IST)",
      experienceLevel: initialData?.experienceLevel || null,
      portfolioUrl: initialData?.portfolioUrl || "",
      linkedinUrl: initialData?.linkedinUrl || "",
      githubUrl: initialData?.githubUrl || "",
      leetcodeUrl: initialData?.leetcodeUrl || "",
      codeforcesUrl: initialData?.codeforcesUrl || "",
      hackerrankUrl: initialData?.hackerrankUrl || "",
      kaggleUrl: initialData?.kaggleUrl || "",
      resumeUrl: initialData?.resumeUrl || "",
      twitterHandle: initialData?.twitterHandle || "",
      instagramHandle: initialData?.instagramHandle || "",
      phoneNumber: initialData?.phoneNumber || "",
      previousProjects: initialData?.previousProjects || [],
    },
  });

  const skills = watch("skills");
  const previousProjects = watch("previousProjects") || [];
  const watchedValues = watch();

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && status !== "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, status]);

  // Profile completion meter calculation (WCAG AA compliant, real data formula)
  const completionDetails = useMemo(() => {
    let score = 0;
    const missing: string[] = [];

    if (watchedValues.name && watchedValues.name.trim().length >= 2) {
      score += 15;
    } else {
      missing.push("Full Name");
    }

    if (watchedValues.bio && watchedValues.bio.trim().length >= 10) {
      score += 15;
    } else {
      missing.push("Bio (at least 10 characters)");
    }

    if (watchedValues.skills && watchedValues.skills.length > 0) {
      score += 20;
    } else {
      missing.push("Skills (at least 1 skill)");
    }

    if (watchedValues.availability) {
      score += 10;
    } else {
      missing.push("Availability");
    }

    if (watchedValues.experienceLevel) {
      score += 10;
    } else {
      missing.push("Experience Level");
    }

    if (watchedValues.resumeUrl && watchedValues.resumeUrl.trim().length > 0) {
      score += 15;
    } else {
      missing.push("Resume or CV link");
    }

    if (
      (watchedValues.githubUrl && watchedValues.githubUrl.trim().length > 0) ||
      (watchedValues.linkedinUrl && watchedValues.linkedinUrl.trim().length > 0) ||
      (watchedValues.portfolioUrl && watchedValues.portfolioUrl.trim().length > 0)
    ) {
      score += 15;
    } else {
      missing.push("GitHub, LinkedIn, or Portfolio URL");
    }

    const nextStep = missing.length > 0 ? missing[0] : null;

    return {
      score,
      nextStep,
      missingCount: missing.length,
    };
  }, [
    watchedValues.name,
    watchedValues.bio,
    watchedValues.skills,
    watchedValues.availability,
    watchedValues.experienceLevel,
    watchedValues.resumeUrl,
    watchedValues.githubUrl,
    watchedValues.linkedinUrl,
    watchedValues.portfolioUrl,
  ]);

  const onSubmit = async (data: ProfileInput) => {
    setStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save profile");
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3500);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Profile Completion Meter ── */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Profile Strength</h2>
              <Badge
                variant={
                  completionDetails.score >= 80
                    ? "success"
                    : completionDetails.score >= 50
                    ? "default"
                    : "warning"
                }
              >
                {completionDetails.score >= 80
                  ? "All Set"
                  : completionDetails.score >= 50
                  ? "Good Progress"
                  : "Incomplete"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calculated from your public skills, bio, links, and availability for compatibility matching.
            </p>
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {completionDetails.score}%
          </span>
        </div>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={completionDetails.score}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full bg-secondary rounded-full overflow-hidden"
        >
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              completionDetails.score >= 80
                ? "bg-emerald-600 dark:bg-emerald-400"
                : completionDetails.score >= 50
                ? "bg-primary"
                : "bg-amber-500"
            }`}
            style={{ width: `${completionDetails.score}%` }}
          />
        </div>

        {/* Next recommended step */}
        {completionDetails.nextStep ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-xl border border-border/60">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong className="text-foreground font-medium">Recommended next step:</strong> Add{" "}
              <span className="text-primary font-medium">{completionDetails.nextStep}</span> to boost
              project recommendations.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Your profile is fully completed and ready for top-tier team matching!</span>
          </div>
        )}
      </div>

      {/* ── Section 1: Basic Information ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">1. Basic Information</h3>
              <p className="text-xs text-muted-foreground">Your public name and personal bio.</p>
            </div>
          </div>
          <Badge variant="outline">Public</Badge>
        </div>

        {/* Full Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Full Name <span className="text-destructive">*</span>
          </label>
          <input
            id="name"
            {...register("name")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="e.g. Alex Rivera"
          />
          {errors.name && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="bio" className="text-sm font-medium text-foreground">
              Bio
            </label>
            <span className="text-xs text-muted-foreground">Up to 600 characters</span>
          </div>
          <RichTextEditor
            value={watch("bio") || ""}
            onChange={(val) => setValue("bio", val, { shouldValidate: true, shouldDirty: true })}
            placeholder="Tell teammates about your background, what you enjoy building, and your dream projects..."
            className="bg-background border-input focus-visible:ring-primary/20 focus-visible:border-primary/50 rounded-xl"
          />
          {errors.bio && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.bio.message}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 2: Skills & Match Preferences ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">2. Skills & Match Preferences</h3>
              <p className="text-xs text-muted-foreground">
                Powers your AI compatibility score with project openings.
              </p>
            </div>
          </div>
          <Badge variant="outline">Public</Badge>
        </div>

        {/* Algorithm impact explanation card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>How your skills determine match scoring</span>
          </div>
          <p className="leading-relaxed">
            ProjectMatch compares your tagged skills against the required roles in open projects. Adding
            at least 5 specific technologies (e.g. Next.js, PyTorch, Figma) significantly increases your
            appearance in team lead recommendations.
          </p>
        </div>

        {/* Skills Tag Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Your Skills & Technologies
          </label>
          <TagInput
            id="skills"
            value={skills || []}
            onChange={(tags) => setValue("skills", tags, { shouldDirty: true })}
            placeholder="Type a skill and press Enter (e.g. React, Python, UI/UX)..."
            suggestions={SKILL_SUGGESTIONS}
            maxTags={30}
          />
          {errors.skills && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.skills.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Click on suggested tags or type your own. Click &times; on any chip to remove it.
          </p>
        </div>
      </div>

      {/* ── Section 3: Experience & Availability ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">3. Experience & Availability</h3>
              <p className="text-xs text-muted-foreground">
                Set clear expectations regarding time commitment and expertise.
              </p>
            </div>
          </div>
          <Badge variant="outline">Public</Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="experienceLevel" className="text-sm font-medium text-foreground">
              Experience Level
            </label>
            <select
              id="experienceLevel"
              {...register("experienceLevel")}
              className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="">Select Level</option>
              {["Beginner", "Intermediate", "Advanced", "Expert"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="availability" className="text-sm font-medium text-foreground">
              Availability
            </label>
            <select
              id="availability"
              {...register("availability")}
              className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
            >
              <option value="">Select Availability</option>
              {["Full-time", "Part-time", "Flexible", "Weekends"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <label htmlFor="timezone" className="text-sm font-medium text-foreground">
            Timezone
          </label>
          <select
            id="timezone"
            {...register("timezone")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Helps teams schedule sync meetings and coordinate hackathon milestones.
          </p>
        </div>
      </div>

      {/* ── Section 4: Relevant Links & Portfolios ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">4. Relevant Links & Portfolios</h3>
              <p className="text-xs text-muted-foreground">
                External verification, resume, and coding profiles.
              </p>
            </div>
          </div>
          <Badge variant="outline">Public</Badge>
        </div>

        {/* Resume / CV Link Callout */}
        <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2">
            <GoogleDriveIcon className="w-5 h-5 text-primary" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">Resume / CV Document Link</h4>
              <p className="text-xs text-muted-foreground">
                Paste your Google Drive, Notion, or cloud document URL. Ensure permissions are set to{" "}
                <span className="font-medium text-foreground">&quot;Anyone with the link can view&quot;</span>.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <input
              id="resumeUrl"
              type="url"
              {...register("resumeUrl")}
              className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
              placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
            />
            {errors.resumeUrl && (
              <p className="text-xs text-destructive">{errors.resumeUrl.message}</p>
            )}
          </div>
        </div>

        {/* GitHub & LinkedIn */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="githubUrl" className="text-sm font-medium flex items-center gap-2 text-foreground">
              <GithubIcon className="w-4 h-4 text-foreground/80" /> GitHub Profile
            </label>
            <input
              id="githubUrl"
              type="url"
              {...register("githubUrl")}
              className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="https://github.com/username"
            />
            {errors.githubUrl && (
              <p className="text-xs text-destructive">{errors.githubUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="linkedinUrl" className="text-sm font-medium flex items-center gap-2 text-foreground">
              <LinkedinIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> LinkedIn Profile
            </label>
            <input
              id="linkedinUrl"
              type="url"
              {...register("linkedinUrl")}
              className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="https://linkedin.com/in/username"
            />
            {errors.linkedinUrl && (
              <p className="text-xs text-destructive">{errors.linkedinUrl.message}</p>
            )}
          </div>
        </div>

        {/* Competitive Programming Handles */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Competitive Programming & Problem Solving
          </h4>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="leetcodeUrl" className="text-sm font-medium flex items-center gap-2 text-foreground">
                <LeetCodeIcon className="w-4 h-4 text-amber-500" /> LeetCode
              </label>
              <input
                id="leetcodeUrl"
                type="url"
                {...register("leetcodeUrl")}
                className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="https://leetcode.com/username"
              />
              {errors.leetcodeUrl && (
                <p className="text-xs text-destructive">{errors.leetcodeUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="codeforcesUrl" className="text-sm font-medium flex items-center gap-2 text-foreground">
                <CodeforcesIcon className="w-4 h-4 text-rose-500" /> Codeforces
              </label>
              <input
                id="codeforcesUrl"
                type="url"
                {...register("codeforcesUrl")}
                className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="https://codeforces.com/profile/username"
              />
              {errors.codeforcesUrl && (
                <p className="text-xs text-destructive">{errors.codeforcesUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="hackerrankUrl" className="text-sm font-medium flex items-center gap-2 text-foreground">
                <HackerRankIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> HackerRank
              </label>
              <input
                id="hackerrankUrl"
                type="url"
                {...register("hackerrankUrl")}
                className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="https://hackerrank.com/username"
              />
              {errors.hackerrankUrl && (
                <p className="text-xs text-destructive">{errors.hackerrankUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="kaggleUrl" className="text-sm font-medium flex items-center gap-2 text-foreground">
                <KaggleIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Kaggle
              </label>
              <input
                id="kaggleUrl"
                type="url"
                {...register("kaggleUrl")}
                className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="https://kaggle.com/username"
              />
              {errors.kaggleUrl && (
                <p className="text-xs text-destructive">{errors.kaggleUrl.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio / Personal Website */}
        <div className="space-y-2 pt-2">
          <label htmlFor="portfolioUrl" className="text-sm font-medium flex items-center gap-2 text-foreground">
            <Globe className="w-4 h-4 text-primary" /> Personal Website / Portfolio URL
          </label>
          <input
            id="portfolioUrl"
            type="url"
            {...register("portfolioUrl")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="https://yourportfolio.dev"
          />
          {errors.portfolioUrl && (
            <p className="text-xs text-destructive">{errors.portfolioUrl.message}</p>
          )}
        </div>
      </div>

      {/* ── Section 5: Proof of Work & Previous Projects ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">5. Proof of Work</h3>
              <p className="text-xs text-muted-foreground">
                Completed projects, slide decks, research papers, and case studies.
              </p>
            </div>
          </div>
          <Badge variant="outline">Public</Badge>
        </div>

        <PreviousProjectsManager
          projects={previousProjects}
          onChange={(projects) =>
            setValue("previousProjects", projects, { shouldValidate: true, shouldDirty: true })
          }
        />
      </div>

      {/* ── Private Account & Contact Details ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-muted-foreground flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Contact & Private Details</h3>
              <p className="text-xs text-muted-foreground">
                Private information shared only with teammates when you join a project.
              </p>
            </div>
          </div>
          <Badge variant="secondary">Private</Badge>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 text-xs text-muted-foreground">
          🔒 Your phone number and direct contact handles are never published on open public listings. They are only made visible to project leads when you apply or connect via direct messages.
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="twitterHandle" className="text-sm font-medium text-foreground">
              X (Twitter) Handle
            </label>
            <input
              id="twitterHandle"
              {...register("twitterHandle")}
              className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="@yourhandle"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="instagramHandle" className="text-sm font-medium text-foreground">
                Instagram Handle (Optional)
              </label>
              <input
                id="instagramHandle"
                {...register("instagramHandle")}
                className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="@yourhandle"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phoneNumber" className="text-sm font-medium text-foreground">
                Phone / WhatsApp (Optional)
              </label>
              <input
                id="phoneNumber"
                {...register("phoneNumber")}
                className="w-full h-11 px-4 rounded-xl border border-input bg-background text-base sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Save Footer Bar ── */}
      <div className="sticky bottom-4 z-20 rounded-2xl border border-border bg-card/95 backdrop-blur-md p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          {isDirty && status === "idle" && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          )}
          {status === "success" && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
              <Check className="w-4 h-4" />
              Profile saved successfully!
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-destructive font-medium text-xs">
              <AlertCircle className="w-4 h-4" />
              {errorMessage || "Failed to save profile"}
            </span>
          )}
          {!isDirty && status === "idle" && (
            <span className="text-xs text-muted-foreground">All changes saved</span>
          )}
        </div>

        <button
          id="save-profile"
          type="submit"
          disabled={status === "saving"}
          className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {status === "saving" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Profile...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Profile
            </>
          )}
        </button>
      </div>
    </form>
  );
}
