-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "HackathonStatus" AS ENUM ('UPCOMING', 'ONGOING', 'ENDED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('OPEN', 'CLOSED', 'COMING_SOON', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FLAGGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ParticipationMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "driveUrl" TEXT,
ADD COLUMN     "projectUrl" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "driveUrl" TEXT,
ADD COLUMN     "hackathonId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "codeforcesUrl" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "hackerrankUrl" TEXT,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kaggleUrl" TEXT,
ADD COLUMN     "leetcodeUrl" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "RoleBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceEventId" TEXT,
    "canonicalUrl" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizerName" TEXT,
    "organizerCredibility" TEXT,
    "websiteUrl" TEXT,
    "devpostUrl" TEXT,
    "registrationUrl" TEXT,
    "bannerUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "registrationStartDate" TIMESTAMP(3),
    "registrationDeadline" TIMESTAMP(3),
    "timezone" TEXT,
    "location" TEXT,
    "participationMode" "ParticipationMode",
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "eligibilityRequirements" TEXT,
    "minTeamSize" INTEGER,
    "maxTeamSize" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prizeAmount" DOUBLE PRECISION,
    "prizeCurrency" TEXT,
    "registrationFee" DOUBLE PRECISION,
    "isNational" BOOLEAN NOT NULL DEFAULT false,
    "nationalEvidence" TEXT,
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "HackathonStatus" NOT NULL DEFAULT 'UPCOMING',
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "firstDiscoveredAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonSyncLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "recordsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HackathonSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL,
    "userOneId" TEXT NOT NULL,
    "userTwoId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "skillsEndorsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "projectId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviousProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectUrl" TEXT,
    "githubUrl" TEXT,
    "driveUrl" TEXT,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreviousProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleBookmark_userId_idx" ON "RoleBookmark"("userId");

-- CreateIndex
CREATE INDEX "RoleBookmark_roleId_idx" ON "RoleBookmark"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleBookmark_userId_roleId_key" ON "RoleBookmark"("userId", "roleId");

-- CreateIndex
CREATE INDEX "Hackathon_startDate_idx" ON "Hackathon"("startDate");

-- CreateIndex
CREATE INDEX "Hackathon_registrationDeadline_idx" ON "Hackathon"("registrationDeadline");

-- CreateIndex
CREATE INDEX "Hackathon_status_idx" ON "Hackathon"("status");

-- CreateIndex
CREATE INDEX "Hackathon_registrationStatus_idx" ON "Hackathon"("registrationStatus");

-- CreateIndex
CREATE INDEX "Hackathon_verificationStatus_idx" ON "Hackathon"("verificationStatus");

-- CreateIndex
CREATE INDEX "Hackathon_isNational_idx" ON "Hackathon"("isNational");

-- CreateIndex
CREATE INDEX "Hackathon_countryCode_idx" ON "Hackathon"("countryCode");

-- CreateIndex
CREATE INDEX "Hackathon_importanceScore_idx" ON "Hackathon"("importanceScore" DESC);

-- CreateIndex
CREATE INDEX "Hackathon_sourceId_idx" ON "Hackathon"("sourceId");

-- CreateIndex
CREATE INDEX "Hackathon_canonicalUrl_idx" ON "Hackathon"("canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Hackathon_sourceId_sourceEventId_key" ON "Hackathon"("sourceId", "sourceEventId");

-- CreateIndex
CREATE INDEX "HackathonSyncLog_sourceId_idx" ON "HackathonSyncLog"("sourceId");

-- CreateIndex
CREATE INDEX "HackathonSyncLog_status_idx" ON "HackathonSyncLog"("status");

-- CreateIndex
CREATE INDEX "HackathonSyncLog_startedAt_idx" ON "HackathonSyncLog"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "DirectConversation_userOneId_idx" ON "DirectConversation"("userOneId");

-- CreateIndex
CREATE INDEX "DirectConversation_userTwoId_idx" ON "DirectConversation"("userTwoId");

-- CreateIndex
CREATE INDEX "DirectConversation_projectId_idx" ON "DirectConversation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_userOneId_userTwoId_key" ON "DirectConversation"("userOneId", "userTwoId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_idx" ON "DirectMessage"("conversationId");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_idx" ON "DirectMessage"("senderId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Review_revieweeId_idx" ON "Review"("revieweeId");

-- CreateIndex
CREATE INDEX "Review_projectId_idx" ON "Review"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewerId_revieweeId_projectId_key" ON "Review"("reviewerId", "revieweeId", "projectId");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- CreateIndex
CREATE INDEX "Report_projectId_idx" ON "Report"("projectId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "PreviousProject_userId_idx" ON "PreviousProject"("userId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBookmark" ADD CONSTRAINT "RoleBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleBookmark" ADD CONSTRAINT "RoleBookmark_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_userOneId_fkey" FOREIGN KEY ("userOneId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_userTwoId_fkey" FOREIGN KEY ("userTwoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviousProject" ADD CONSTRAINT "PreviousProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
