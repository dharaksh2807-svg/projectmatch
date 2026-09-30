import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AI_MODELS = [
  {
    id: "gemini-3.8-flash-medium",
    name: "Gemini 3.8 Flash Medium",
    provider: "google",
    tier: "fast",
    modelString: "gemini-2.0-flash",
    contextWindow: 1_000_000,
    isActive: true,
  },
  {
    id: "gemini-3.7-flash-medium",
    name: "Gemini 3.7 Flash Medium",
    provider: "google",
    tier: "fast",
    modelString: "gemini-2.0-flash-lite",
    contextWindow: 1_000_000,
    isActive: true,
  },
  {
    id: "gemini-3.6-flash-medium",
    name: "Gemini 3.6 Flash Medium",
    provider: "google",
    tier: "fast",
    modelString: "gemini-1.5-flash",
    contextWindow: 1_000_000,
    isActive: true,
  },
  {
    id: "gemini-3.1-pro-high",
    name: "Gemini 3.1 Pro High",
    provider: "google",
    tier: "high",
    modelString: "gemini-2.5-pro",
    contextWindow: 2_000_000,
    isActive: true,
  },
  {
    id: "claude-sonnet-4.6-thinking",
    name: "Claude Sonnet 4.6 Thinking",
    provider: "anthropic",
    tier: "thinking",
    modelString: "claude-sonnet-4-5",
    contextWindow: 200_000,
    isActive: true,
  },
  {
    id: "claude-opus-4.6-thinking",
    name: "Claude Opus 4.6 Thinking",
    provider: "anthropic",
    tier: "thinking",
    modelString: "claude-opus-4-5",
    contextWindow: 200_000,
    isActive: true,
  },
  {
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B",
    provider: "oss",
    tier: "medium",
    modelString: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    contextWindow: 128_000,
    isActive: true,
  },
] as const;

const SYSTEM_AGENTS = [
  {
    id: "system-agent-tester",
    name: "The Ultimate Full Stack Tester",
    modelId: "gemini-3.6-flash-medium",
    systemPrompt: "You are the Ultimate Full-Stack QA and Security Tester from a top-tier tech company. You do not write new features; you aggressively attack and audit existing code. Look for React dependency array bugs, hydration mismatches, SQL injection vectors, SSR leaks, and race conditions. Provide strictly formatted bug reports with exact line numbers and proposed fixes.",
    temperature: 0.2,
    isPublic: true,
  },
  {
    id: "system-agent-developer",
    name: "The Senior Developer",
    modelId: "claude-opus-4.6-thinking",
    systemPrompt: "You are a Senior Backend Software Engineer. You write zero-overhead, highly optimized TypeScript. Your primary objective is to implement complex business logic, third-party integrations, and data transformers. You NEVER use 'any' in TypeScript, you always handle errors gracefully with try/catch, and you write highly modular, functional code.",
    temperature: 0.7,
    isPublic: true,
  },
  {
    id: "system-agent-ui",
    name: "The UI/UX Wizard",
    modelId: "claude-sonnet-4.6-thinking",
    systemPrompt: "You are an elite UI/UX engineer specializing in React, Next.js, Tailwind CSS (v4), and shadcn/ui. Your goal is to construct pixel-perfect, highly responsive, and accessible interfaces. Focus on minimalist design, proper z-indexing, glassmorphism aesthetics, and smooth framer-motion micro-animations. Always return production-ready TSX code.",
    temperature: 0.8,
    isPublic: true,
  },
  {
    id: "system-agent-db",
    name: "The Database & Architecture Admin",
    modelId: "gemini-3.1-pro-high",
    systemPrompt: "You are a Principal Database Architect. Your domain is Prisma ORM, PostgreSQL, Redis, and Next.js App Router API design. Prioritize absolute data consistency, strictly typed interfaces, index optimization for fast reads, and normalized relational modeling. When asked to design a schema, think about edge cases, cascade deletions, and pagination.",
    temperature: 0.3,
    isPublic: true,
  }
];

async function main() {
  console.log("🌱 Seeding AI models...");

  for (const model of AI_MODELS) {
    await prisma.aIModel.upsert({
      where: { id: model.id },
      update: {
        name: model.name,
        provider: model.provider,
        tier: model.tier,
        modelString: model.modelString,
        contextWindow: model.contextWindow,
        isActive: model.isActive,
      },
      create: model,
    });
    console.log(`  ✅ ${model.name}`);
  }

  console.log(`\n✨ Seeded ${AI_MODELS.length} AI models successfully.`);

  console.log("\n🌱 Seeding System User & Agents...");
  const systemUser = await prisma.user.upsert({
    where: { email: "system@projectmatch.ai" },
    update: {},
    create: {
      name: "System",
      email: "system@projectmatch.ai",
    },
  });

  for (const agent of SYSTEM_AGENTS) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: {
        name: agent.name,
        modelId: agent.modelId,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        isPublic: agent.isPublic,
      },
      create: {
        ...agent,
        userId: systemUser.id,
      },
    });
    console.log(`  ✅ ${agent.name}`);
  }

  console.log(`\n✨ Seeded ${SYSTEM_AGENTS.length} System Agents successfully.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
