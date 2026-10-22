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
  githubUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  leetcodeUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  codeforcesUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  hackerrankUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  kaggleUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  resumeUrl: z.string().url("Must be a valid URL (e.g. Google Drive link)").optional().nullable().or(z.literal("")),
  twitterHandle: z.string().max(50).optional().nullable(),
  instagramHandle: z.string().max(50).optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
  previousProjects: z.array(z.object({
    id: z.string().optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(120),
    description: z.string().max(2000, "Description cannot exceed 2000 characters").optional().nullable().or(z.literal("")),
    techStack: z.array(z.string().min(1).max(50)).max(20, "Maximum 20 skills/tech").default([]),
    projectUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
    githubUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
    driveUrl: z.string().url("Must be a valid URL (e.g. Google Drive link)").optional().nullable().or(z.literal("")),
    fileType: z.string().max(60).optional().nullable().or(z.literal("")),
  })).max(30, "Maximum 30 previous projects").optional(),
});

export const previousProjectSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "Title must be at least 2 characters").max(120),
  description: z.string().max(2000, "Description cannot exceed 2000 characters").optional().nullable().or(z.literal("")),
  techStack: z.array(z.string().min(1).max(50)).max(20, "Maximum 20 skills/tech").default([]),
  projectUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  githubUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  driveUrl: z.string().url("Must be a valid URL (e.g. Google Drive link)").optional().nullable().or(z.literal("")),
  fileType: z.string().max(60).optional().nullable().or(z.literal("")),
});

export type PreviousProjectInput = z.infer<typeof previousProjectSchema>;
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
  driveUrl: z.string().url().optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
  roles: z.array(roleSchema).min(1, "At least one role is required").max(10),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const ratingSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  revieweeId: z.string().min(1, "Reviewee ID is required").optional(),
  rateeId: z.string().min(1).optional(), // Legacy alias for revieweeId
  rating: z.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars").optional(),
  score: z.number().int().min(1).max(5).optional(), // Legacy alias for rating
  ratingCommunication: z.number().int().min(1).max(5).nullable().optional(),
  ratingCollaboration: z.number().int().min(1).max(5).nullable().optional(),
  ratingReliability: z.number().int().min(1).max(5).nullable().optional(),
  ratingTechnical: z.number().int().min(1).max(5).nullable().optional(),
  content: z.string().max(500, "Content cannot exceed 500 characters").optional(),
  comment: z.string().max(500).optional(), // Legacy alias for content
  skillsEndorsed: z.array(z.string()).max(10, "Maximum 10 skills").optional().default([]),
}).transform((data) => ({
  projectId: data.projectId,
  revieweeId: (data.revieweeId || data.rateeId) as string,
  rating: data.rating || data.score,
  ratingCommunication: data.ratingCommunication ?? null,
  ratingCollaboration: data.ratingCollaboration ?? null,
  ratingReliability: data.ratingReliability ?? null,
  ratingTechnical: data.ratingTechnical ?? null,
  content: data.content || data.comment || "",
  skillsEndorsed: data.skillsEndorsed || [],
}));

export type RatingInput = z.infer<typeof ratingSchema>;

export const reviewEditSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  ratingCommunication: z.number().int().min(1).max(5).nullable().optional(),
  ratingCollaboration: z.number().int().min(1).max(5).nullable().optional(),
  ratingReliability: z.number().int().min(1).max(5).nullable().optional(),
  ratingTechnical: z.number().int().min(1).max(5).nullable().optional(),
  content: z.string().max(500, "Content cannot exceed 500 characters").optional(),
  skillsEndorsed: z.array(z.string()).max(10, "Maximum 10 skills").optional(),
});

export type ReviewEditInput = z.infer<typeof reviewEditSchema>;

export const reviewResponseSchema = z.object({
  responseContent: z
    .string()
    .min(5, "Response must be at least 5 characters")
    .max(500, "Response cannot exceed 500 characters"),
});

export type ReviewResponseInput = z.infer<typeof reviewResponseSchema>;

export const reviewDisputeSchema = z.object({
  reason: z
    .string()
    .min(10, "Please provide a reason for the dispute (at least 10 characters)")
    .max(500, "Reason cannot exceed 500 characters"),
});

export type ReviewDisputeInput = z.infer<typeof reviewDisputeSchema>;

export const applicationActionSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  message: z.string().max(2000, "Cover message cannot exceed 2000 characters").optional(),
  projectUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  driveUrl: z.string().url("Must be a valid URL (e.g. Google Drive link)").optional().or(z.literal("")),
});

export type ApplicationActionInput = z.infer<typeof applicationActionSchema>;
