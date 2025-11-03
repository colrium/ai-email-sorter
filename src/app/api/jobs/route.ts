/**
 * Jobs API
 * GET /api/jobs - Get queue metrics and job status
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getQueueMetrics } from "@/lib/queue/queues";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/jobs
 * Get queue metrics and job counts
 */
export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get queue metrics
    const metrics = await getQueueMetrics();

    logger.info("Queue metrics retrieved", {
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Jobs API error", { error });

    return NextResponse.json(
      { error: "Failed to fetch job metrics" },
      { status: 500 }
    );
  }
}
