"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations";
import { TagInput } from "@/components/shared/tag-input";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";

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
      bio: initialData?.bio || "",
      skills: initialData?.skills || [],
      availability: initialData?.availability || null,
      timezone: initialData?.timezone || "UTC+5:30 (IST)",
      experienceLevel: initialData?.experienceLevel || null,
      portfolioUrl: initialData?.portfolioUrl || "",
      linkedinUrl: initialData?.linkedinUrl || "",
      twitterHandle: initialData?.twitterHandle || "",
      instagramHandle: initialData?.instagramHandle || "",
      phoneNumber: initialData?.phoneNumber || "",
    },
  });

  const skills = watch("skills");

  const onSubmit = async (data: ProfileInput) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Full Name
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

      {/* Bio */}
      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          {...register("bio")}
          className="w-full h-24 px-4 py-3 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          placeholder="Tell teammates a bit about yourself..."
        />
        {errors.bio && (
          <p className="text-xs text-destructive">{errors.bio.message}</p>
        )}
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Skills
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

      {/* Experience & Availability */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="experienceLevel" className="text-sm font-medium">
            Experience Level
          </label>
          <select
            id="experienceLevel"
            {...register("experienceLevel")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            <option value="">Select Level</option>
            {["Beginner", "Intermediate", "Advanced", "Expert"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="availability" className="text-sm font-medium">
            Availability
          </label>
          <select
            id="availability"
            {...register("availability")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
          >
            <option value="">Select Availability</option>
            {["Full-time", "Part-time", "Flexible", "Weekends"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <label htmlFor="timezone" className="text-sm font-medium">
          Timezone
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

      {/* Social Links */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="portfolioUrl" className="text-sm font-medium">
            Portfolio URL
          </label>
          <input
            id="portfolioUrl"
            type="url"
            {...register("portfolioUrl")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="https://yourwebsite.com"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="linkedinUrl" className="text-sm font-medium">
            LinkedIn URL
          </label>
          <input
            id="linkedinUrl"
            type="url"
            {...register("linkedinUrl")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="https://linkedin.com/in/you"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="twitterHandle" className="text-sm font-medium">
          X (Twitter) Handle
        </label>
        <input
          id="twitterHandle"
          {...register("twitterHandle")}
          className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          placeholder="@yourhandle"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="instagramHandle" className="text-sm font-medium">
            Instagram Handle (Optional)
          </label>
          <input
            id="instagramHandle"
            {...register("instagramHandle")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="@yourhandle"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="phoneNumber" className="text-sm font-medium">
            Phone / WhatsApp (Optional)
          </label>
          <input
            id="phoneNumber"
            {...register("phoneNumber")}
            className="w-full h-11 px-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="+1 234 567 890"
          />
        </div>
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
