import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { computeCompatibility } from "@/lib/matching";

/**
 * GET /api/matches/ai
 * AI Matchmaker API
 * 
 * 1. Retrieves the current user's profile.
 * 2. Fetches open roles and pre-filters the top 10 using classical scoring (performance/token optimization).
 * 3. Sends the user profile and top 10 roles to Gemini to pick the best 3.
 * 4. Returns the AI's top 3 matches with a personalized explanation.
 */
export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 1. Fetch User Profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        bio: true,
        skills: true,
        experienceLevel: true,
        availability: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.skills || user.skills.length === 0) {
      return NextResponse.json(
        { error: "Please add skills to your profile to get AI matches." },
        { status: 400 }
      );
    }

    // 2. Fetch Open Roles
    const roles = await prisma.role.findMany({
      where: {
        isOpen: true,
        project: { 
          isPublished: true,
          ownerId: { not: userId },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            projectType: true,
            duration: true,
            ownerId: true,
          },
        },
      },
    });

    if (roles.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Map to matching engine UserProfile structure
    const matchUser = {
      id: user.id,
      name: user.name,
      skills: user.skills,
      interests: [],
      availabilityHours: null,
      experienceLevel: user.experienceLevel,
    };

    // Pre-filter to Top 10 using classical algorithm to save LLM tokens
    const scoredRoles = roles
      .map((r) => ({
        ...r,
        compatibility: computeCompatibility(matchUser, r as any),
      }))
      .sort((a, b) => b.compatibility.score - a.compatibility.score)
      .slice(0, 10);

    // 3. Prepare AI Prompt
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY not found, returning classical top 3 instead.");
      return NextResponse.json({
        matches: scoredRoles.slice(0, 3).map((r) => ({
          roleId: r.id,
          aiScore: Math.round(r.compatibility.score * 100),
          explanation: "AI Matchmaker is currently offline. This is a fallback match based on skill overlap.",
          role: r,
        })),
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          description: "Top 3 best role matches for the user",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              roleId: {
                type: SchemaType.STRING,
                description: "The ID of the role",
              },
              aiScore: {
                type: SchemaType.NUMBER,
                description: "AI confidence score from 0 to 100",
              },
              explanation: {
                type: SchemaType.STRING,
                description: "A 2-sentence explanation addressed directly to the user (e.g. 'You would be a great fit because...') on why their specific skills and bio match this role and project.",
              },
            },
            required: ["roleId", "aiScore", "explanation"],
          },
        },
      },
    });

    const prompt = `
You are an expert tech recruiter and hackathon matchmaker.
Your goal is to analyze a User's Profile and a list of Open Roles, and select the TOP 3 absolute best matches.

USER PROFILE:
Name: ${user.name}
Bio: ${user.bio || "None provided"}
Skills: ${user.skills.join(", ")}
Experience Level: ${user.experienceLevel || "Any"}
Availability: ${user.availability || "Flexible"}

AVAILABLE ROLES:
${JSON.stringify(
  scoredRoles.map((r) => ({
    roleId: r.id,
    roleTitle: r.title,
    requiredSkills: r.requiredSkills,
    requiredExperience: r.requiredExperienceLevel,
    timeCommitment: r.timeCommitment,
    projectTitle: r.project.title,
    projectDescription: r.project.description,
    projectType: r.project.projectType,
  })),
  null,
  2
)}

Select the top 3 most synergistic roles for this user. Output the result in the requested JSON format.
`;

    // 4. Generate & Parse AI Response
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const aiMatches = JSON.parse(responseText) as {
      roleId: string;
      aiScore: number;
      explanation: string;
    }[];

    // Combine AI output with actual DB Role data
    const finalMatches = aiMatches
      .map((aiMatch) => {
        const fullRole = scoredRoles.find((r) => r.id === aiMatch.roleId);
        return fullRole ? { ...aiMatch, role: fullRole } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.aiScore - a!.aiScore);

    return NextResponse.json({ matches: finalMatches });
  } catch (err) {
    console.error("GET /api/matches/ai failed:", err);
    return NextResponse.json(
      { error: "AI Matchmaker failed to process request" },
      { status: 500 }
    );
  }
  } catch (outerErr) {
    console.error("GET /api/matches/ai unhandled error:", outerErr);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
