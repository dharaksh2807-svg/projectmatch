/**
 * Shared Domain Types for ProjectMatch Platform
 */

export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type ProjectType =
  | "Hackathon"
  | "Startup"
  | "Open Source"
  | "Side Project"
  | "Research"
  | "Competition";

export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface UserSummary {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  skills?: string[];
  experienceLevel?: string | null;
  bio?: string | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  twitterHandle?: string | null;
  reputationScore?: number;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: UserSummary;
  isOptimistic?: boolean;
}

export interface DirectConversation {
  id: string;
  userOneId: string;
  userTwoId: string;
  projectId?: string | null;
  otherUser: UserSummary;
  project?: {
    id: string;
    title: string;
    projectType: string;
  } | null;
  lastMessage?: DirectMessage | null;
  hasUnread: boolean;
  updatedAt: string;
}

export interface Hackathon {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  devpostUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    projects: number;
  };
  projects?: {
    id: string;
    title: string;
    projectType: string;
    owner: {
      name: string | null;
      image: string | null;
    };
    roles: {
      id: string;
      title: string;
      requiredSkills: string[];
    }[];
  }[];
}

export interface Role {
  id: string;
  projectId: string;
  title: string;
  description: string;
  requiredSkills: string[];
  requiredExperienceLevel: string;
  timeCommitment: string;
  headcount: number;
  filledCount: number;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  projectType: ProjectType;
  duration: string;
  techStack: string[];
  repoUrl?: string | null;
  websiteUrl?: string | null;
  isPublished: boolean;
  hackathonId?: string | null;
  hackathon?: Hackathon | null;
  roles?: Role[];
  owner?: UserSummary;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  roleId: string;
  projectId: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  user?: UserSummary;
  role: Role;
  project: Project;
}

export interface AIMatchRoleResult {
  roleId: string;
  aiScore: number;
  explanation: string;
  role: {
    id: string;
    title: string;
    requiredSkills: string[];
    project: {
      id: string;
      title: string;
      projectType: string;
    };
  };
}
