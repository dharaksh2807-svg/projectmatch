// src/lib/validations.ts — shared Zod schemas for Profile and Project

import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  skills: z
    .array(z.string().min(1).max(50))
    .min(1, "Add at least one skill")
    .max(30, "Maximum 30 skills"),
  interests: z.array(z.string().min(1).max(50)).max(20),
  availabilityHours: z.coerce
    .number()
    .int()
    .min(1, "Must be at least 1 hour")
    .max(80, "Maximum 80 hours per week"),
  availabilityDuration: z.enum(["1-2 weeks", "1 month", "3 months", "6+ months", "Ongoing"]),
  timezone: z.string().min(1, "Timezone is required"),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]),
  portfolioLinks: z.array(z.string().url("Must be a valid URL")).max(10),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const roleSchema = z.object({
  title: z.string().min(2).max(100),
  requiredSkills: z.array(z.string().min(1)).min(1, "At least one skill required").max(20),
  requiredExperienceLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert", "Any"]),
  timeCommitment: z.string().min(1),
  headcount: z.coerce.number().int().min(1).max(20),
});

export type RoleInput = z.infer<typeof roleSchema>;

export const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  projectType: z.enum(["Hackathon", "Startup", "Research", "Open Source", "Side Project", "Competition"]),
  duration: z.enum(["< 1 week", "1-4 weeks", "1-3 months", "3-6 months", "6+ months"]),
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
  actionType: z.enum(["APPLY", "INVITE"]),
  candidateId: z.string().optional(),
});

export type ApplicationActionInput = z.infer<typeof applicationActionSchema>;
