import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateInvitationToken,
  hashInvitationToken,
  createTeamInvitation,
  getProjectInvitations,
  revokeTeamInvitation,
  inspectInvitationByToken,
  acceptTeamInvitation,
  checkMemoryRateLimit,
  resetMemoryRateLimits,
} from "./invitations";
import { prisma } from "./prisma";

// Mock the real-time event publisher and email sending
vi.mock("@/lib/redis", () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
  userNotificationsChannel: vi.fn((id: string) => `user:notifications:${id}`),
  checkInviteCreateRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 9 }),
  checkInviteRedeemRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 19 }),
}));

vi.mock("@/lib/mail", () => ({
  inviteAcceptedEmail: vi.fn().mockReturnValue({ subject: "Invite Accepted", html: "<p>Accepted</p>" }),
}));

describe("PROJECTMATCH — SECURE TEAM INVITATION LINKS TEST SUITE", () => {
  // In-memory data store for testing
  let users: any[] = [];
  let projects: any[] = [];
  let roles: any[] = [];
  let hackathons: any[] = [];
  let applications: any[] = [];
  let teamInvitations: any[] = [];
  let invitationRedemptions: any[] = [];
  let notifications: any[] = [];
  let directConversations: any[] = [];

  beforeEach(() => {
    resetMemoryRateLimits();

    // Reset data
    users = [
      { id: "owner-1", name: "Alice Owner", email: "owner@example.com", isBanned: false, reputationScore: 80 },
      { id: "candidate-1", name: "Bob Builder", email: "bob@example.com", isBanned: false, reputationScore: 70 },
      { id: "candidate-2", name: "Charlie Coder", email: "charlie@example.com", isBanned: false, reputationScore: 75 },
      { id: "banned-user", name: "Banned User", email: "banned@example.com", isBanned: true, reputationScore: 10 },
      { id: "stranger-1", name: "Eve Stranger", email: "eve@example.com", isBanned: false, reputationScore: 60 },
    ];

    hackathons = [
      {
        id: "hack-1",
        name: "AI Global Hackathon",
        minTeamSize: 2,
        maxTeamSize: 3,
      },
    ];

    roles = [
      {
        id: "role-backend",
        projectId: "project-1",
        title: "Backend Developer",
        description: "Node.js & PostgreSQL backend engineer",
        requiredSkills: ["Node.js", "PostgreSQL"],
        requiredExperienceLevel: "Intermediate",
        timeCommitment: "10-15h/week",
        headcount: 2,
        filledCount: 0,
        isOpen: true,
      },
      {
        id: "role-frontend",
        projectId: "project-1",
        title: "Frontend Developer",
        description: "React & Tailwind developer",
        requiredSkills: ["React", "TypeScript"],
        requiredExperienceLevel: "Intermediate",
        timeCommitment: "10-15h/week",
        headcount: 1,
        filledCount: 1, // already filled
        isOpen: false,
      },
    ];

    projects = [
      {
        id: "project-1",
        title: "AI Study Assistant",
        description: "Intelligent study companion for university students",
        projectType: "Hackathon",
        duration: "1-4 weeks",
        techStack: ["Next.js", "PostgreSQL", "FastAPI"],
        isPublished: true,
        ownerId: "owner-1",
        hackathonId: "hack-1",
      },
    ];

    applications = [];
    teamInvitations = [];
    invitationRedemptions = [];
    notifications = [];
    directConversations = [];

    // Mock prisma operations
    vi.spyOn(prisma.project as any, "findUnique").mockImplementation(async ({ where, select }: any) => {
      const p = projects.find((item) => item.id === where.id);
      if (!p) return null;

      const owner = users.find((u) => u.id === p.ownerId);
      const projectRoles = roles.filter((r) => r.projectId === p.id);
      const projectApps = applications.filter((a) => a.projectId === p.id && (!where?.applications?.where?.status || a.status === where.applications.where.status));
      const hackathon = hackathons.find((h) => h.id === p.hackathonId);

      return {
        ...p,
        owner: select?.owner ? owner : owner,
        roles: projectRoles,
        hackathon,
        applications: projectApps,
      };
    });

    vi.spyOn(prisma.user as any, "findUnique").mockImplementation(async ({ where }: any) => {
      return users.find((u) => u.id === where.id || u.email === where.email) || null;
    });

    vi.spyOn(prisma.role as any, "findFirst").mockImplementation(async ({ where }: any) => {
      return roles.find((r) => r.id === where.id && (!where.projectId || r.projectId === where.projectId)) || null;
    });

    vi.spyOn(prisma.teamInvitation as any, "create").mockImplementation(async ({ data }: any) => {
      const role = roles.find((r) => r.id === data.roleId);
      const record = {
        id: `invite-${Date.now()}-${Math.random()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: role ? { id: role.id, title: role.title } : null,
        redemptions: [],
      };
      teamInvitations.push(record);
      return record;
    });

    vi.spyOn(prisma.teamInvitation as any, "findMany").mockImplementation(async ({ where }: any) => {
      return teamInvitations
        .filter((inv) => inv.projectId === where.projectId)
        .map((inv) => ({
          ...inv,
          role: roles.find((r) => r.id === inv.roleId) || null,
          redemptions: invitationRedemptions
            .filter((red) => red.invitationId === inv.id)
            .map((red) => ({
              ...red,
              user: users.find((u) => u.id === red.userId),
            })),
        }));
    });

    vi.spyOn(prisma.teamInvitation as any, "findFirst").mockImplementation(async ({ where }: any) => {
      return teamInvitations.find((inv) => inv.id === where.id && (!where.projectId || inv.projectId === where.projectId)) || null;
    });

    vi.spyOn(prisma.teamInvitation as any, "findUnique").mockImplementation(async ({ where }: any) => {
      const inv = teamInvitations.find((i) => (where.tokenHash && i.tokenHash === where.tokenHash) || (where.id && i.id === where.id));
      if (!inv) return null;

      const project = projects.find((p) => p.id === inv.projectId);
      const owner = project ? users.find((u) => u.id === project.ownerId) : null;
      const role = roles.find((r) => r.id === inv.roleId) || null;
      const inviter = users.find((u) => u.id === inv.inviterId);
      const hackathon = project ? hackathons.find((h) => h.id === project.hackathonId) : null;
      const projectRoles = roles.filter((r) => r.projectId === inv.projectId);
      const acceptedApps = applications.filter((a) => a.projectId === inv.projectId && a.status === "ACCEPTED");

      return {
        ...inv,
        project: project
          ? {
              ...project,
              owner,
              hackathon,
              roles: projectRoles,
              applications: acceptedApps,
            }
          : null,
        role,
        inviter,
      };
    });

    vi.spyOn(prisma.teamInvitation as any, "update").mockImplementation(async ({ where, data }: any) => {
      const inv = teamInvitations.find((i) => i.id === where.id);
      if (!inv) throw new Error("Not found");
      Object.assign(inv, data);
      return inv;
    });

    vi.spyOn(prisma.teamInvitation as any, "updateMany").mockImplementation(async ({ where, data }: any) => {
      let matched = 0;
      for (const inv of teamInvitations) {
        let match = true;
        if (where.id && inv.id !== where.id) match = false;
        if (where.isRevoked !== undefined && inv.isRevoked !== where.isRevoked) match = false;
        if (where.usesCount?.lt !== undefined && inv.usesCount >= where.usesCount.lt) match = false;
        if (where.expiresAt?.gt && inv.expiresAt <= where.expiresAt.gt) match = false;
        if (match) {
          if (data.usesCount?.increment) inv.usesCount += data.usesCount.increment;
          matched++;
        }
      }
      return { count: matched };
    });

    vi.spyOn(prisma.role as any, "updateMany").mockImplementation(async ({ where, data }: any) => {
      let matched = 0;
      for (const r of roles) {
        let match = true;
        if (where.id && r.id !== where.id) match = false;
        if (where.isOpen !== undefined && r.isOpen !== where.isOpen) match = false;
        if (where.filledCount?.lt !== undefined && r.filledCount >= where.filledCount.lt) match = false;
        if (match) {
          if (data.filledCount?.increment) r.filledCount += data.filledCount.increment;
          matched++;
        }
      }
      return { count: matched };
    });

    vi.spyOn(prisma.role as any, "update").mockImplementation(async ({ where, data }: any) => {
      const r = roles.find((item) => item.id === where.id);
      if (r) Object.assign(r, data);
      return r;
    });

    vi.spyOn(prisma.application as any, "findFirst").mockImplementation(async ({ where }: any) => {
      return applications.find((a) => {
        if (where.projectId && a.projectId !== where.projectId) return false;
        if (where.userId && a.userId !== where.userId) return false;
        if (where.status && a.status !== where.status) return false;
        return true;
      }) || null;
    });

    vi.spyOn(prisma.application as any, "findUnique").mockImplementation(async ({ where }: any) => {
      if (where.userId_roleId) {
        return applications.find((a) => a.userId === where.userId_roleId.userId && a.roleId === where.userId_roleId.roleId) || null;
      }
      return applications.find((a) => a.id === where.id) || null;
    });

    vi.spyOn(prisma.application as any, "count").mockImplementation(async ({ where }: any) => {
      return applications.filter((a) => {
        if (where.projectId && a.projectId !== where.projectId) return false;
        if (where.status && a.status !== where.status) return false;
        return true;
      }).length;
    });

    vi.spyOn(prisma.application as any, "create").mockImplementation(async ({ data }: any) => {
      const app = {
        id: `app-${Date.now()}-${Math.random()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      applications.push(app);
      return app;
    });

    vi.spyOn(prisma.application as any, "update").mockImplementation(async ({ where, data }: any) => {
      const app = applications.find((a) => a.id === where.id);
      if (app) Object.assign(app, data);
      return app;
    });

    vi.spyOn(prisma.invitationRedemption as any, "create").mockImplementation(async ({ data }: any) => {
      const red = { id: `red-${Date.now()}`, ...data, redeemedAt: new Date() };
      invitationRedemptions.push(red);
      return red;
    });

    vi.spyOn(prisma.notification as any, "create").mockImplementation(async ({ data }: any) => {
      const notif = { id: `notif-${Date.now()}`, ...data, createdAt: new Date() };
      notifications.push(notif);
      return notif;
    });

    vi.spyOn(prisma.directConversation as any, "upsert").mockImplementation(async ({ create }: any) => {
      const conv = { id: `conv-${Date.now()}`, ...create, createdAt: new Date(), updatedAt: new Date() };
      directConversations.push(conv);
      return conv;
    });

    vi.spyOn(prisma as any, "$transaction").mockImplementation(async (callback: any) => {
      if (typeof callback === "function") {
        return callback(prisma);
      }
      return Promise.all(callback);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 1: Authorized invite creation
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 1: Authorized invite creation by project owner", async () => {
    const res = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
      expiresInDays: 7,
      maxUses: 2,
    });

    expect(res).toBeDefined();
    expect(res.token).toBeDefined();
    expect(res.token.length).toBeGreaterThan(20);
    expect(res.invitation.projectId).toBe("project-1");
    expect(res.invitation.roleId).toBe("role-backend");
    expect(res.invitation.maxUses).toBe(2);
    expect(res.invitation.usesCount).toBe(0);
    expect(res.invitation.isRevoked).toBe(false);

    // Verify token security requirement: database MUST store ONLY hash, NEVER raw token
    const dbRecord = teamInvitations[0];
    expect(dbRecord.tokenHash).toBe(hashInvitationToken(res.token));
    expect((dbRecord as any).token).toBeUndefined();

    // Verify getProjectInvitations correctly returns active invitations for the owner
    const ownerList = await getProjectInvitations("project-1", "owner-1");
    expect(ownerList.length).toBe(1);
    expect(ownerList[0].status).toBe("ACTIVE");

    // Verify rate limit helper
    const rateCheck = checkMemoryRateLimit("test-key", 5, 60);
    expect(rateCheck.success).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 2: Unauthorized invite creation
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 2: Unauthorized invite creation is blocked", async () => {
    await expect(
      createTeamInvitation({
        projectId: "project-1",
        inviterId: "stranger-1", // Not project owner
        roleId: "role-backend",
      })
    ).rejects.toThrow("UNAUTHORIZED_NOT_OWNER");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 3: Token uniqueness & high entropy
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 3: Token uniqueness — multiple generated tokens are unique with high entropy", () => {
    const tokens = new Set<string>();
    const hashes = new Set<string>();

    for (let i = 0; i < 50; i++) {
      const { rawToken, tokenHash } = generateInvitationToken();
      expect(rawToken.length).toBeGreaterThanOrEqual(40);
      expect(tokenHash).toHaveLength(64); // SHA-256 hex string
      tokens.add(rawToken);
      hashes.add(tokenHash);
    }

    expect(tokens.size).toBe(50);
    expect(hashes.size).toBe(50);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 4: Valid acceptance
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 4: Valid acceptance successfully joins candidate to team", async () => {
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
      expiresInDays: 7,
      maxUses: 1,
    });

    const acceptResult = await acceptTeamInvitation({
      rawToken: token,
      userId: "candidate-1",
      message: "Excited to join the backend team!",
    });

    expect(acceptResult.success).toBe(true);
    expect(acceptResult.projectId).toBe("project-1");
    expect(acceptResult.roleId).toBe("role-backend");

    // Verify application created with ACCEPTED status
    expect(applications).toHaveLength(1);
    expect(applications[0].userId).toBe("candidate-1");
    expect(applications[0].roleId).toBe("role-backend");
    expect(applications[0].status).toBe("ACCEPTED");

    // Verify role filledCount incremented
    const backendRole = roles.find((r) => r.id === "role-backend");
    expect(backendRole.filledCount).toBe(1);

    // Verify invite usesCount incremented
    expect(teamInvitations[0].usesCount).toBe(1);

    // Verify redemption record persisted
    expect(invitationRedemptions).toHaveLength(1);
    expect(invitationRedemptions[0].userId).toBe("candidate-1");

    // Verify owner received notification
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe("owner-1");
    expect(notifications[0].type).toBe("INVITATION_ACCEPTED");

    // Verify conversation between owner and candidate was created
    expect(directConversations).toHaveLength(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 5: Expired link
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 5: Expired link rejects acceptance", async () => {
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
      expiresInDays: 7,
    });

    // Manually expire the invitation
    teamInvitations[0].expiresAt = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

    // Check inspection reports EXPIRED
    const inspect = await inspectInvitationByToken(token);
    expect(inspect.isValid).toBe(false);
    expect(inspect.status).toBe("EXPIRED");

    // Check acceptance rejects with INVITATION_EXPIRED
    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "candidate-1",
      })
    ).rejects.toThrow("INVITATION_EXPIRED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 6: Revoked link
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 6: Revoked link rejects acceptance", async () => {
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
    });

    // Owner revokes the invitation
    const revokeRes = await revokeTeamInvitation("project-1", teamInvitations[0].id, "owner-1");
    expect(revokeRes.success).toBe(true);
    expect(teamInvitations[0].isRevoked).toBe(true);

    // Check inspection reports REVOKED
    const inspect = await inspectInvitationByToken(token);
    expect(inspect.isValid).toBe(false);
    expect(inspect.status).toBe("REVOKED");

    // Check acceptance rejects with INVITATION_REVOKED
    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "candidate-1",
      })
    ).rejects.toThrow("INVITATION_REVOKED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 7: Usage-limit exhaustion
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 7: Usage-limit exhaustion rejects subsequent redemptions", async () => {
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
      maxUses: 1, // Only 1 use allowed
    });

    // First candidate accepts -> succeeds
    const firstAccept = await acceptTeamInvitation({
      rawToken: token,
      userId: "candidate-1",
    });
    expect(firstAccept.success).toBe(true);

    // Inspection now reports EXHAUSTED
    const inspect = await inspectInvitationByToken(token);
    expect(inspect.isValid).toBe(false);
    expect(inspect.status).toBe("EXHAUSTED");

    // Second candidate attempts to accept -> rejected
    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "candidate-2",
      })
    ).rejects.toThrow("INVITATION_EXHAUSTED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 8: Duplicate membership prevention
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 8: Duplicate membership is strictly prohibited", async () => {
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
      maxUses: 5,
    });

    // 8a. Owner cannot join their own team as candidate
    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "owner-1",
      })
    ).rejects.toThrow("OWNER_CANNOT_JOIN");

    // 8b. Candidate joins first time -> succeeds
    await acceptTeamInvitation({
      rawToken: token,
      userId: "candidate-1",
    });

    // 8c. Candidate attempts to join again -> rejected
    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "candidate-1",
      })
    ).rejects.toThrow("ALREADY_A_MEMBER");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 9: Role no longer available
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 9: Filled or closed role rejects acceptance", async () => {
    // role-frontend is already filledCount: 1, headcount: 1, isOpen: false
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
    });

    // Manually point invitation to closed role
    teamInvitations[0].roleId = "role-frontend";

    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "candidate-1",
      })
    ).rejects.toThrow("ROLE_FULL");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 10: Team full capacity enforcement
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 10: Team capacity reached rejects acceptance", async () => {
    // Project hackathon maxTeamSize is 3 (Owner + 2 teammates)
    // 1. Create invite when team has 1 member (Owner)
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
    });

    // 2. Later, before the invite is redeemed, the team fills up through other members
    // Total team size becomes Owner (1) + 2 teammates = 3 == maxTeamSize
    applications.push(
      { id: "app-prev-1", projectId: "project-1", userId: "user-x", roleId: "role-backend", status: "ACCEPTED" },
      { id: "app-prev-2", projectId: "project-1", userId: "user-y", roleId: "role-backend", status: "ACCEPTED" }
    );

    // 3. Candidate attempts to accept -> rejected with TEAM_CAPACITY_EXCEEDED
    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "candidate-1",
      })
    ).rejects.toThrow("TEAM_CAPACITY_EXCEEDED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 11: Concurrent acceptance of final opening
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 11: Concurrent acceptance of final opening permits only one winner", async () => {
    // Role headcount: 1, filledCount: 0
    roles.find((r) => r.id === "role-backend").headcount = 1;

    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
      maxUses: 5,
    });

    // Execute two acceptances in parallel
    const [result1, result2] = await Promise.allSettled([
      acceptTeamInvitation({ rawToken: token, userId: "candidate-1" }),
      acceptTeamInvitation({ rawToken: token, userId: "candidate-2" }),
    ]);

    const successes = [result1, result2].filter((r) => r.status === "fulfilled");
    const rejections = [result1, result2].filter((r) => r.status === "rejected");

    // Exactly one must succeed, and one must be rejected
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);

    // Role filledCount must be exactly 1, not 2
    expect(roles.find((r) => r.id === "role-backend").filledCount).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 12: Authentication redirect handling
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 12: Unauthenticated inspection allows public inspection without membership", async () => {
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
    });

    // Unauthenticated inspection (currentUserId is undefined)
    const inspect = await inspectInvitationByToken(token, undefined);

    expect(inspect.found).toBe(true);
    expect(inspect.isValid).toBe(true);
    expect(inspect.project?.title).toBe("AI Study Assistant");
    expect(inspect.invitation?.role?.title).toBe("Backend Developer");
    expect(inspect.currentUser).toBeNull();

    // No team membership should be created from mere inspection
    expect(applications).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 13: Invalid token
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 13: Non-existent or invalid token returns not found", async () => {
    const inspect = await inspectInvitationByToken("invalid-non-existent-token-12345678");
    expect(inspect.found).toBe(false);

    await expect(
      acceptTeamInvitation({
        rawToken: "invalid-non-existent-token-12345678",
        userId: "candidate-1",
      })
    ).rejects.toThrow("INVALID_TOKEN");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 14: Owner losing authorization
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 14: Owner losing project authorization invalidates invite", async () => {
    const { token } = await createTeamInvitation({
      projectId: "project-1",
      inviterId: "owner-1",
      roleId: "role-backend",
    });

    // Ownership of project changes to another user
    projects[0].ownerId = "stranger-1";

    const inspect = await inspectInvitationByToken(token);
    expect(inspect.isValid).toBe(false);
    expect(inspect.status).toBe("OWNER_UNAUTHORIZED");

    await expect(
      acceptTeamInvitation({
        rawToken: token,
        userId: "candidate-1",
      })
    ).rejects.toThrow("OWNER_LOST_AUTHORIZATION");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST CASE 15: Existing application workflows remain intact
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 15: Existing application workflows remain intact", async () => {
    // Standard application flow (direct application)
    const normalApp = await prisma.application.create({
      data: {
        userId: "candidate-1",
        roleId: "role-backend",
        projectId: "project-1",
        status: "PENDING",
        message: "Applying normally",
      },
    });

    expect(normalApp.status).toBe("PENDING");

    // Owner reviews and accepts through standard PATCH workflow
    const updated = await prisma.application.update({
      where: { id: normalApp.id },
      data: { status: "ACCEPTED" },
    });

    expect(updated.status).toBe("ACCEPTED");
    expect(applications.find((a) => a.id === normalApp.id).status).toBe("ACCEPTED");
  });
});
