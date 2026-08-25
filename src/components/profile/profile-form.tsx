"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations";
import { TagInput } from "@/components/shared/tag-input";
import { Loader2, Save, CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react";

const SKILL_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "Go", "Rust",
  "C++", "Swift", "Kotlin", "Figma", "UI/UX Design", "Product Design", "Graphic Design",
  "Machine Learning", "Data Science", "TensorFlow", "PyTorch", "SQL", "PostgreSQL", "MongoDB",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "DevOps", "CI/CD", "Android", "iOS",
  "Flutter", "React Native", "Web3", "Solidity", "Blockchain", "Game Dev", "Unity",
];

const INTEREST_SUGGESTIONS = [
  "EdTech", "HealthTech", "FinTech", "Climate", "AI/ML", "Gaming", "Social Impact",
  "Open Source", "Dev Tools", "Productivity", "E-commerce", "SaaS", "Blockchain/Web3",
  "AR/VR", "Research", "Mobile", "Security", "IoT", "Space Tech", "Biotech",
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
  initialData?: Partial<ProfileInput> & { name?: string };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>(
    initialData?.portfolioLinks || []
  );
  const [newLink, setNewLink] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData?.name || "",
      skills: initialData?.skills || [],
      interests: initialData?.interests || [],
      availabilityHours: initialData?.availabilityHours || 10,
      availabilityDuration: initialData?.availabilityDuration || "1 month",
      timezone: initialData?.timezone || "UTC+5:30 (IST)",
      experienceLevel: initialData?.experienceLevel || "Intermediate",
      portfolioLinks: initialData?.portfolioLinks || [],
    },
  });

  const skills = watch("skills");
  const interests = watch("interests");

  const onSubmit = async (data: ProfileInput) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, portfolioLinks }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const addPortfolioLink = () => {
    if (!newLink.trim() || portfolioLinks.includes(newLink)) return;
    try {
      new URL(newLink);
      const updated = [...portfolioLinks, newLink.trim()];
      setPortfolioLinks(updated);
      setValue("portfolioLinks", updated);
      setNewLink("");
    } catch {
      // invalid URL
    }
  };

  const removePortfolioLink = (link: string) => {
    const updated = portfolioLinks.filter((l) => l !== link);
    setPortfolioLinks(updated);
    setValue("portfolioLinks", updated);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Full Name <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          {...register("name")}
          className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder="Your full name"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Skills <span className="text-destructive">*</span>
        </label>
        <TagInput
          id="skills"
          value={skills || []}
          onChange={(tags) => setValue("skills", tags, { shouldDirty: true })}
          placeholder="e.g. React, Python, Figma..."
          suggestions={SKILL_SUGGESTIONS}
          maxTags={30}
        />
        {errors.skills && (
          <p className="text-xs text-destructive">{errors.skills.message}</p>
        )}
      </div>

      {/* Interests */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Interests & Domains</label>
        <TagInput
          id="interests"
          value={interests || []}
          onChange={(tags) => setValue("interests", tags, { shouldDirty: true })}
          placeholder="e.g. HealthTech, Open Source..."
          suggestions={INTEREST_SUGGESTIONS}
          maxTags={20}
        />
      </div>

      {/* Availability */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="availabilityHours" className="text-sm font-medium">
            Availability (hrs/week) <span className="text-destructive">*</span>
          </label>
          <input
            id="availabilityHours"
            type="number"
            min={1}
            max={80}
            {...register("availabilityHours")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {errors.availabilityHours && (
            <p className="text-xs text-destructive">{errors.availabilityHours.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="availabilityDuration" className="text-sm font-medium">
            Duration <span className="text-destructive">*</span>
          </label>
          <select
            id="availabilityDuration"
            {...register("availabilityDuration")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            {["1-2 weeks", "1 month", "3 months", "6+ months", "Ongoing"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Experience & Timezone */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="experienceLevel" className="text-sm font-medium">
            Experience Level <span className="text-destructive">*</span>
          </label>
          <select
            id="experienceLevel"
            {...register("experienceLevel")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            {["Beginner", "Intermediate", "Advanced", "Expert"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="timezone" className="text-sm font-medium">
            Timezone <span className="text-destructive">*</span>
          </label>
          <select
            id="timezone"
            {...register("timezone")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Portfolio Links */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Portfolio Links</label>
        <div className="space-y-2">
          {portfolioLinks.map((link) => (
            <div
              key={link}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary/30 group"
            >
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-primary hover:underline truncate"
              >
                {link}
              </a>
              <button
                type="button"
                onClick={() => removePortfolioLink(link)}
                className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="url"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPortfolioLink())}
              placeholder="https://github.com/yourusername"
              className="flex-1 h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              type="button"
              onClick={addPortfolioLink}
              className="h-11 px-4 rounded-xl border border-border hover:border-primary/30 hover:bg-accent transition-all flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">GitHub, LinkedIn, portfolio site, etc.</p>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2">
        <button
          id="save-profile"
          type="submit"
          disabled={status === "saving" || status === "success"}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl brand-gradient text-white font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50 glow-sm"
        >
          {status === "saving" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : status === "success" ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Profile
            </>
          )}
        </button>

        {status === "error" && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to save. Please try again.
          </div>
        )}
      </div>
    </form>
  );
}
