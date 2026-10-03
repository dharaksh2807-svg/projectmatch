// src/lib/validations.ts — shared Zod schemas for Profile and Project

import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80).optional(),
  bio: z.string().max(600, "Bio cannot exceed 600 characters").optional().nullable(),
  skills: z
    .array(z.string().min(1).max(50))
    .max(30, "Maximum 30 skills")
    .optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional().nullable(),
  availability: z.enum(["Full-time", "Part-time", "Flexible", "Weekends"]).optional().nullable(),
  timezone: z.string().min(1, "Timezone is required").max(60).optional().nullable(),
  portfolioUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  twitterHandle: z.string().max(50).optional().nullable(),
  instagramHandle: z.string().max(50).optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const roleSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  requiredSkills: z.array(z.string().min(1)).max(20).default([]),
  requiredExperienceLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert", "Any"]),
  timeCommitment: z.string().min(1).max(100),
  headcount: z.coerce.number().int().min(1).max(20).default(1),
});

export type RoleInput = z.infer<typeof roleSchema>;

export const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(120).trim(),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000).trim(),
  projectType: z.enum(["Hackathon", "Startup", "Research", "Open Source", "Side Project", "Competition"]),
  duration: z.enum(["< 1 week", "1-4 weeks", "1-3 months", "3-6 months", "6+ months"]),
  techStack: z.array(z.string().min(1)).max(30).default([]),
  repoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
  roles: z.array(roleSchema).min(1, "At least one role is required").max(10),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const ratingSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  rateeId: z.string().min(1, "Ratee ID is required"),
  score: z.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  comment: z.string().max(500, "Comment cannot exceed 500 characters").optional(),
});

export type RatingInput = z.infer<typeof ratingSchema>;

export const applicationActionSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  message: z.string().max(2000, "Cover message cannot exceed 2000 characters").optional(),
});

export type ApplicationActionInput = z.infer<typeof applicationActionSchema>;
