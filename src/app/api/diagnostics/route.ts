import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? `SET (${process.env.DATABASE_URL.substring(0, 20)}...)` : "MISSING",
      DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL ? `SET (${process.env.DIRECT_DATABASE_URL.substring(0, 20)}...)` : "MISSING",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "MISSING",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET" : "MISSING",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "SET" : "MISSING",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Test 1: Session
  try {
    const session = await getServerSession(authOptions);
    diagnostics.session = session ? { email: session.user?.email, name: session.user?.name } : null;
  } catch (e: unknown) {
    diagnostics.sessionError = e instanceof Error ? e.message : String(e);
  }

  // Test 2: Prisma connection
  try {
    const { prisma } = await import("@/lib/prisma");
    const userCount = await prisma.user.count();
    diagnostics.prisma = { connected: true, userCount };
  } catch (e: unknown) {
    diagnostics.prismaError = e instanceof Error ? { message: e.message, stack: e.stack?.split("\n").slice(0, 5) } : String(e);
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
