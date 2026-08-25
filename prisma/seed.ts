/**
 * Seed script for testing the ProjectMatch matching engine.
 * Run with: npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DIRECT_DATABASE_URL ||
  "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable&connection_limit=10";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding ProjectMatch database...\n");

  // Clear existing seed data
  await prisma.rating.deleteMany();
  await prisma.application.deleteMany();
  await prisma.$executeRaw`DELETE FROM "_TeamMembers"`;
  await prisma.team.deleteMany();
  await prisma.role.deleteMany();
  await prisma.project.deleteMany();

  // -- USERS (reputationScore is now 0–100; 50 = neutral) --
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "alice@example.com" },
      update: {
        skills: ["React", "TypeScript", "Next.js", "UI/UX Design", "Figma"],
        interests: ["EdTech", "AI/ML", "Open Source"],
        availabilityHours: 15,
        availabilityDuration: "3 months",
        timezone: "UTC+8:00 (SGT)",
        experienceLevel: "Advanced",
        portfolioLinks: ["https://github.com/alice"],
        reputationScore: 84,
      },
      create: {
        name: "Alice Chen",
        email: "alice@example.com",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
        skills: ["React", "TypeScript", "Next.js", "UI/UX Design", "Figma"],
        interests: ["EdTech", "AI/ML", "Open Source"],
        availabilityHours: 15,
        availabilityDuration: "3 months",
        timezone: "UTC+8:00 (SGT)",
        experienceLevel: "Advanced",
        portfolioLinks: ["https://github.com/alice"],
        reputationScore: 84,
      },
    }),
    prisma.user.upsert({
      where: { email: "bob@example.com" },
      update: {
        skills: ["Python", "Machine Learning", "TensorFlow", "PyTorch", "Data Science"],
        interests: ["AI/ML", "Research", "HealthTech"],
        availabilityHours: 20,
        availabilityDuration: "1 month",
        timezone: "UTC+5:30 (IST)",
        experienceLevel: "Expert",
        portfolioLinks: ["https://github.com/bob", "https://kaggle.com/bob"],
        reputationScore: 96,
      },
      create: {
        name: "Bob Kumar",
        email: "bob@example.com",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
        skills: ["Python", "Machine Learning", "TensorFlow", "PyTorch", "Data Science"],
        interests: ["AI/ML", "Research", "HealthTech"],
        availabilityHours: 20,
        availabilityDuration: "1 month",
        timezone: "UTC+5:30 (IST)",
        experienceLevel: "Expert",
        portfolioLinks: ["https://github.com/bob", "https://kaggle.com/bob"],
        reputationScore: 96,
      },
    }),
    prisma.user.upsert({
      where: { email: "carol@example.com" },
      update: {
        skills: ["Node.js", "PostgreSQL", "Docker", "AWS", "Go"],
        interests: ["DevOps", "Open Source", "SaaS"],
        availabilityHours: 10,
        availabilityDuration: "6+ months",
        timezone: "UTC-5:00 (ET)",
        experienceLevel: "Advanced",
        portfolioLinks: ["https://github.com/carol"],
        reputationScore: 78,
      },
      create: {
        name: "Carol Smith",
        email: "carol@example.com",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=carol",
        skills: ["Node.js", "PostgreSQL", "Docker", "AWS", "Go"],
        interests: ["DevOps", "Open Source", "SaaS"],
        availabilityHours: 10,
        availabilityDuration: "6+ months",
        timezone: "UTC-5:00 (ET)",
        experienceLevel: "Advanced",
        portfolioLinks: ["https://github.com/carol"],
        reputationScore: 78,
      },
    }),
    prisma.user.upsert({
      where: { email: "dan@example.com" },
      update: {
        skills: ["React", "JavaScript", "CSS"],
        interests: ["Gaming", "Side Project"],
        availabilityHours: 5,
        availabilityDuration: "1-2 weeks",
        timezone: "UTC+9:00 (JST)",
        experienceLevel: "Beginner",
        portfolioLinks: [],
        reputationScore: 50,
      },
      create: {
        name: "Dan Park",
        email: "dan@example.com",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=dan",
        skills: ["React", "JavaScript", "CSS"],
        interests: ["Gaming", "Side Project"],
        availabilityHours: 5,
        availabilityDuration: "1-2 weeks",
        timezone: "UTC+9:00 (JST)",
        experienceLevel: "Beginner",
        portfolioLinks: [],
        reputationScore: 50,
      },
    }),
    prisma.user.upsert({
      where: { email: "owner@example.com" },
      update: {
        skills: ["Product Design", "Figma", "React"],
        interests: ["Startup", "EdTech"],
        availabilityHours: 30,
        availabilityDuration: "6+ months",
        timezone: "UTC+0:00 (London)",
        experienceLevel: "Intermediate",
        portfolioLinks: ["https://linkedin.com/in/eve"],
        reputationScore: 70,
      },
      create: {
        name: "Eve Johnson",
        email: "owner@example.com",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=eve",
        skills: ["Product Design", "Figma", "React"],
        interests: ["Startup", "EdTech"],
        availabilityHours: 30,
        availabilityDuration: "6+ months",
        timezone: "UTC+0:00 (London)",
        experienceLevel: "Intermediate",
        portfolioLinks: ["https://linkedin.com/in/eve"],
        reputationScore: 70,
      },
    }),
  ]);

  const [alice, bob, carol, dan, eve] = users;
  console.log(`✅ Created/updated ${users.length} seed users`);

  // -- ACTIVE PROJECTS + ROLES --
  const project1 = await prisma.project.create({
    data: {
      ownerId: eve.id,
      title: "AI-Powered Study Companion",
      description:
        "Building a personalized learning assistant that adapts to each student's pace and style. Uses ML to identify knowledge gaps and generate targeted exercises.",
      projectType: "Startup",
      duration: "3-6 months",
      status: "ACTIVE",
      roles: {
        create: [
          {
            title: "Frontend Developer",
            requiredSkills: ["React", "TypeScript", "Next.js"],
            requiredExperienceLevel: "Intermediate",
            timeCommitment: "10-20 hrs/week",
            headcount: 1,
          },
          {
            title: "ML Engineer",
            requiredSkills: ["Python", "Machine Learning", "TensorFlow"],
            requiredExperienceLevel: "Advanced",
            timeCommitment: "10-20 hrs/week",
            headcount: 1,
          },
          {
            title: "Backend Developer",
            requiredSkills: ["Node.js", "PostgreSQL", "Docker"],
            requiredExperienceLevel: "Intermediate",
            timeCommitment: "5-10 hrs/week",
            headcount: 1,
          },
        ],
      },
    },
    include: { roles: true },
  });

  const project2 = await prisma.project.create({
    data: {
      ownerId: alice.id,
      title: "Open Source Contribution Tracker",
      description:
        "A platform to gamify and track contributions to open source projects. Help developers build their portfolio while contributing to the ecosystem.",
      projectType: "Open Source",
      duration: "1-3 months",
      status: "ACTIVE",
      roles: {
        create: [
          {
            title: "Full Stack Developer",
            requiredSkills: ["React", "Node.js", "PostgreSQL"],
            requiredExperienceLevel: "Any",
            timeCommitment: "5-10 hrs/week",
            headcount: 2,
          },
          {
            title: "Data Engineer",
            requiredSkills: ["Python", "SQL", "Docker"],
            requiredExperienceLevel: "Intermediate",
            timeCommitment: "5-10 hrs/week",
            headcount: 1,
          },
        ],
      },
    },
    include: { roles: true },
  });

  console.log(`✅ Created 2 active seed projects with roles`);

  // -- COMPLETED PROJECT (for Phase 6 rating demo) --
  // Eve owned it; Alice + Bob were team members; Carol was also on team
  const completedProject = await prisma.project.create({
    data: {
      ownerId: eve.id,
      title: "HealthTrack Hackathon",
      description:
        "A 48-hour hackathon project building a personal health monitoring dashboard with AI-powered insights. COMPLETED.",
      projectType: "Hackathon",
      duration: "< 1 week",
      status: "COMPLETED",
      roles: {
        create: [
          {
            title: "Frontend Lead",
            requiredSkills: ["React", "TypeScript"],
            requiredExperienceLevel: "Advanced",
            timeCommitment: "Full-time",
            headcount: 1,
            filledCount: 1,
          },
          {
            title: "ML Specialist",
            requiredSkills: ["Python", "Machine Learning"],
            requiredExperienceLevel: "Expert",
            timeCommitment: "Full-time",
            headcount: 1,
            filledCount: 1,
          },
          {
            title: "Backend Engineer",
            requiredSkills: ["Node.js", "PostgreSQL"],
            requiredExperienceLevel: "Advanced",
            timeCommitment: "Full-time",
            headcount: 1,
            filledCount: 1,
          },
        ],
      },
    },
    include: { roles: true },
  });

  // Build the team: eve (owner + member), alice, bob, carol
  const completedTeam = await prisma.team.create({
    data: {
      projectId: completedProject.id,
      members: {
        connect: [
          { id: eve.id },
          { id: alice.id },
          { id: bob.id },
          { id: carol.id },
        ],
      },
    },
  });

  // Seed some ratings (alice → bob, alice → carol, bob → alice, eve → alice)
  // so reputation scores are already populated for demo
  const ratingsData = [
    { raterId: alice.id, rateeId: bob.id, score: 5, comment: "Incredible ML skills, delivered beyond expectations." },
    { raterId: alice.id, rateeId: carol.id, score: 4, comment: "Solid backend work, great communicator." },
    { raterId: alice.id, rateeId: eve.id, score: 4, comment: "Great product vision and leadership." },
    { raterId: bob.id, rateeId: alice.id, score: 5, comment: "Best frontend dev I've worked with!" },
    { raterId: bob.id, rateeId: carol.id, score: 4, comment: "Reliable and efficient." },
    { raterId: bob.id, rateeId: eve.id, score: 3, comment: "Good owner, could improve communication." },
    { raterId: carol.id, rateeId: alice.id, score: 4, comment: "Great collaborator." },
    { raterId: carol.id, rateeId: bob.id, score: 5, comment: "Absolute expert in ML." },
    { raterId: eve.id, rateeId: alice.id, score: 5, comment: "Outstanding frontend quality." },
    { raterId: eve.id, rateeId: bob.id, score: 5, comment: "Bob is exceptional." },
    { raterId: eve.id, rateeId: carol.id, score: 4, comment: "Very dependable." },
  ];

  for (const r of ratingsData) {
    await prisma.rating.create({
      data: {
        teamId: completedTeam.id,
        projectId: completedProject.id,
        raterId: r.raterId,
        rateeId: r.rateeId,
        score: r.score,
        comment: r.comment,
      },
    });
  }

  // Recompute reputation scores from seeded ratings
  const rateeIds = [...new Set(ratingsData.map((r) => r.rateeId))];
  for (const rateeId of rateeIds) {
    const allRatings = await prisma.rating.findMany({ where: { rateeId } });
    const normalizedScore =
      (allRatings.reduce((sum, r) => sum + r.score, 0) / (allRatings.length * 5)) * 100;
    await prisma.user.update({
      where: { id: rateeId },
      data: { reputationScore: Math.round(normalizedScore * 10) / 10 },
    });
  }

  // Dan has never been rated → stays at 50 (neutral)

  console.log(`✅ Created 1 completed project with team (${completedTeam.id}) and ${ratingsData.length} seed ratings`);

  // -- Accepted applications for the completed project (so it shows in applications) --
  const completedRoles = completedProject.roles;
  const frontendRole = completedRoles.find((r) => r.title === "Frontend Lead")!;
  const mlRole2 = completedRoles.find((r) => r.title === "ML Specialist")!;
  const backendRole = completedRoles.find((r) => r.title === "Backend Engineer")!;

  await prisma.application.createMany({
    data: [
      { roleId: frontendRole.id, userId: alice.id, status: "ACCEPTED" },
      { roleId: mlRole2.id, userId: bob.id, status: "ACCEPTED" },
      { roleId: backendRole.id, userId: carol.id, status: "ACCEPTED" },
    ],
  });

  console.log(`✅ Linked accepted applications to completed project`);
  console.log("\n✅ Seeding complete! Database is ready for Phase 6 testing.");
  console.log("\nTest personas:");
  console.log("  alice@example.com  → Frontend dev, team member of completed project (can rate teammates)");
  console.log("  bob@example.com    → ML expert, team member of completed project");
  console.log("  carol@example.com  → Backend dev, team member of completed project");
  console.log("  owner@example.com  → Eve, owns both ACTIVE and COMPLETED projects");
  console.log("  dan@example.com    → New user, no ratings (neutral 50.0 reputation)\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
