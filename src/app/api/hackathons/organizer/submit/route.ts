import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  HackathonStatus,
  RegistrationStatus,
  VerificationStatus,
  ParticipationMode,
  EligibilityScope,
  HackathonStream,
  OrganizerType,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// SSRF Protection — rejects loopback and RFC-1918 private IP ranges
// ─────────────────────────────────────────────────────────────────────────────

const PRIVATE_IP_RE =
  /^(\[?::1\]?|localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)/i;

/**
 * Returns true when the supplied URL targets a loopback address, a private
 * RFC-1918 range, or uses a non-HTTP/HTTPS scheme. Used to block SSRF vectors.
 */
function isSsrfRisk(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true; // unparseable URLs are rejected
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const host = parsed.hostname;
  return PRIVATE_IP_RE.test(host);
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod Input Schema
// ─────────────────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  // ── Event Identity ────────────────────────────────────────────────────────
  name: z
    .string({ required_error: "Event name is required" })
    .min(3, "Event name must be at least 3 characters")
    .max(120, "Event name must be 120 characters or fewer"),

  description: z
    .string({ required_error: "Description is required" })
    .min(20, "Description must be at least 20 characters")
    .max(5000, "Description must be 5000 characters or fewer"),

  // ── College & Location ────────────────────────────────────────────────────
  collegeName: z
    .string({ required_error: "College name is required" })
    .min(2, "College name must be at least 2 characters")
    .max(150, "College name must be 150 characters or fewer"),

  collegeSlug: z.string().max(100).optional().nullable(),

  campusName: z.string().max(150).optional().nullable(),

  venueAddress: z.string().max(300).optional().nullable(),

  city: z
    .string({ required_error: "City is required" })
    .min(2, "City must be at least 2 characters")
    .max(80, "City must be 80 characters or fewer"),

  state: z
    .string({ required_error: "State is required" })
    .min(2, "State must be at least 2 characters")
    .max(80, "State must be 80 characters or fewer"),

  // ── Participation & Eligibility ───────────────────────────────────────────
  participationMode: z.enum(["OFFLINE", "ONLINE", "HYBRID"], {
    required_error: "Participation mode is required",
    invalid_type_error: "Participation mode must be OFFLINE, ONLINE, or HYBRID",
  }),

  eligibilityScope: z.enum(
    ["OPEN_TO_ALL", "ANY_COLLEGE_STUDENT", "HOST_COLLEGE_ONLY"],
    {
      required_error: "Eligibility scope is required",
      invalid_type_error:
        "Eligibility scope must be OPEN_TO_ALL, ANY_COLLEGE_STUDENT, or HOST_COLLEGE_ONLY",
    }
  ),

  // ── Dates ─────────────────────────────────────────────────────────────────
  startDate: z.string({ required_error: "Start date is required" }).datetime({
    message: "Start date must be a valid ISO-8601 datetime string",
  }),

  endDate: z.string({ required_error: "End date is required" }).datetime({
    message: "End date must be a valid ISO-8601 datetime string",
  }),

  registrationDeadline: z
    .string({ required_error: "Registration deadline is required" })
    .datetime({
      message:
        "Registration deadline must be a valid ISO-8601 datetime string",
    }),

  // ── URLs ──────────────────────────────────────────────────────────────────
  registrationUrl: z
    .string({ required_error: "Registration URL is required" })
    .url("Registration URL must be a valid URL (http/https)"),

  websiteUrl: z
    .string()
    .url("Website URL must be a valid URL (http/https)")
    .optional()
    .nullable(),

  bannerUrl: z
    .string()
    .url("Banner URL must be a valid URL (http/https)")
    .optional()
    .nullable(),

  // ── Organizer ─────────────────────────────────────────────────────────────
  organizerClubName: z
    .string({ required_error: "Organizer club / chapter name is required" })
    .min(2, "Organizer name must be at least 2 characters")
    .max(100, "Organizer name must be 100 characters or fewer"),

  organizerContact: z
    .string({ required_error: "Organizer contact is required" })
    .min(3, "Contact must be at least 3 characters")
    .max(150, "Contact must be 150 characters or fewer"),

  // ── Prizes & Fees ─────────────────────────────────────────────────────────
  prizeAmount: z.number().min(0).optional().nullable(),
  prizeCurrency: z.string().max(10).default("INR"),
  registrationFee: z.number().min(0).default(0),

  // ── Tech Tags ─────────────────────────────────────────────────────────────
  tags: z.array(z.string().max(50)).max(20).default([]),
});

type SubmitInput = z.infer<typeof submitSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: derive a URL-safe slug from the college name
// e.g. "SRM Institute of Science and Technology" → "srm-institute-of-science-and-technology"
// ─────────────────────────────────────────────────────────────────────────────

function toCollegeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hackathons/organizer/submit
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Authentication ─────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized", message: "You must be signed in to submit a hackathon." },
      { status: 401 }
    );
  }
  const uploaderId = session.user.id;

  // ── 2. Parse & Validate JSON Body ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation Failed",
        message: "One or more fields are invalid. See details below.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const data: SubmitInput = parsed.data;

  // ── 3. SSRF Protection: Validate External URLs ────────────────────────────
  if (isSsrfRisk(data.registrationUrl)) {
    return NextResponse.json(
      {
        error: "Invalid URL",
        message:
          "registrationUrl must point to a public internet address (not localhost or a private IP range).",
      },
      { status: 400 }
    );
  }
  if (data.websiteUrl && isSsrfRisk(data.websiteUrl)) {
    return NextResponse.json(
      {
        error: "Invalid URL",
        message:
          "websiteUrl must point to a public internet address (not localhost or a private IP range).",
      },
      { status: 400 }
    );
  }
  if (data.bannerUrl && isSsrfRisk(data.bannerUrl)) {
    return NextResponse.json(
      {
        error: "Invalid URL",
        message:
          "bannerUrl must point to a public internet address (not localhost or a private IP range).",
      },
      { status: 400 }
    );
  }

  // ── 4. Business Logic: Date Ordering Checks ───────────────────────────────
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const regDeadline = new Date(data.registrationDeadline);
  const now = new Date();

  if (startDate <= now) {
    return NextResponse.json(
      {
        error: "Invalid Date",
        message: "startDate must be in the future.",
      },
      { status: 400 }
    );
  }

  if (endDate <= startDate) {
    return NextResponse.json(
      {
        error: "Invalid Date",
        message: "endDate must be after startDate.",
      },
      { status: 400 }
    );
  }

  if (regDeadline > startDate) {
    return NextResponse.json(
      {
        error: "Invalid Date",
        message:
          "registrationDeadline must be on or before the hackathon startDate.",
      },
      { status: 400 }
    );
  }

  // ── 5. Derive Normalized collegeSlug ─────────────────────────────────────
  const collegeSlug =
    data.collegeSlug && data.collegeSlug.trim().length > 0
      ? data.collegeSlug.trim()
      : toCollegeSlug(data.collegeName);

  // ── 6. Persist to Database ───────────────────────────────────────────────
  try {
    const hackathon = await prisma.hackathon.create({
      data: {
        // ── Stream & Submission Classification ────────────────────────────
        stream: HackathonStream.COMMUNITY_LOCAL,
        isCommunitySubmitted: true,

        // ── Event Identity ─────────────────────────────────────────────────
        name: data.name,
        description: data.description,

        // ── Institutional Location ────────────────────────────────────────
        collegeName: data.collegeName,
        collegeSlug,
        campusName: data.campusName ?? null,
        venueAddress: data.venueAddress ?? null,
        city: data.city,
        state: data.state,
        country: "India",
        countryCode: "IN",

        // ── Participation Mode & Eligibility ──────────────────────────────
        participationMode: data.participationMode as ParticipationMode,
        eligibilityScope: data.eligibilityScope as EligibilityScope,

        // ── Dates ─────────────────────────────────────────────────────────
        startDate,
        endDate,
        registrationDeadline: regDeadline,
        timezone: "Asia/Kolkata",

        // ── URLs ──────────────────────────────────────────────────────────
        registrationUrl: data.registrationUrl,
        websiteUrl: data.websiteUrl ?? null,
        bannerUrl: data.bannerUrl ?? null,

        // ── Organizer ─────────────────────────────────────────────────────
        organizerClubName: data.organizerClubName,
        organizerContact: data.organizerContact,
        organizerName: data.organizerClubName,
        organizerType: OrganizerType.COLLEGE_CLUB,

        // ── Prizes & Fees ─────────────────────────────────────────────────
        prizeAmount: data.prizeAmount ?? null,
        prizeCurrency: data.prizeCurrency,
        registrationFee: data.registrationFee,

        // ── Tech Tags ─────────────────────────────────────────────────────
        tags: data.tags,

        // ── Lifecycle & Verification Status ──────────────────────────────
        isNational: false,
        status: HackathonStatus.UPCOMING,
        registrationStatus: RegistrationStatus.OPEN,
        verificationStatus: VerificationStatus.VERIFIED,

        // ── Provenance ────────────────────────────────────────────────────
        firstDiscoveredAt: new Date(),
        lastSyncAt: new Date(),

        // ── Uploader Relation ─────────────────────────────────────────────
        uploadedByUserId: uploaderId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Hackathon submitted successfully and is now live.",
        hackathon,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    // Log full error server-side; return a safe message to the client.
    console.error("[organizer/submit] Database error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message:
          "Failed to save the hackathon. Please try again. If the problem persists, contact support.",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Method guard — explicitly reject all other HTTP verbs with a clear error
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", message: "Use POST to submit a hackathon." },
    { status: 405 }
  );
}
