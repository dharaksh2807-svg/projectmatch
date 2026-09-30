import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/models
 * Public — returns all active AI models for the model selector UI.
 */
export async function GET() {
  try {
    const models = await prisma.aIModel.findMany({
      where: { isActive: true },
      orderBy: [{ provider: "asc" }, { tier: "asc" }],
    });
    return NextResponse.json(models);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
