/**
 * Bulk Delete Emails API
 * DELETE /api/emails/bulk-delete
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { queueBulkDelete } from "@/lib/queue/queues";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

// Request validation schema
const bulkDeleteSchema = z.object({
  emailIds: z
    .array(z.string().uuid())
    .min(1, "At least one email ID is required"),
});

/**
 * POST /api/emails/bulk-delete
 * Queue bulk email deletion
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { emailIds } = validation.data;

    logger.info("Queuing bulk delete", {
      userId: session.user.id,
      emailCount: emailIds.length,
    });

    // Queue the bulk delete job
    const job = await queueBulkDelete({
      emailIds,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      emailCount: emailIds.length,
      message: `Queued deletion of ${emailIds.length} emails`,
    });
  } catch (error) {
    logger.error("Bulk delete API error", { error });

    return NextResponse.json(
      { error: "Failed to queue bulk delete" },
      { status: 500 }
    );
  }
}
