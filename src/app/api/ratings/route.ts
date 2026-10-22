import { NextRequest } from "next/server";
import { POST as handleReviewPost } from "@/app/api/reviews/route";

/**
 * POST /api/ratings
 * Legacy compatibility endpoint forwarding directly to /api/reviews.
 */
export async function POST(req: NextRequest) {
  return handleReviewPost(req);
}
