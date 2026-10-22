import { NextRequest } from "next/server";
import { GET as handleEligibleGet } from "@/app/api/reviews/eligible/route";

/**
 * GET /api/ratings/pending
 * Legacy compatibility endpoint forwarding directly to /api/reviews/eligible.
 */
export async function GET(req: NextRequest) {
  return handleEligibleGet(req);
}
