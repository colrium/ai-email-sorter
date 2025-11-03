/**
 * API Route: Bulk Unsubscribe
 * POST /api/emails/bulk-unsubscribe
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { bulkUnsubscribe } from "@/lib/services/unsubscribe-service";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

interface BulkUnsubscribeRequest {
  emailIds: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BulkUnsubscribeRequest = await request.json();
    const { emailIds } = body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json({ error: "Invalid email IDs" }, { status: 400 });
    }

    // Verify all emails belong to user
    const emails = await prisma.email.findMany({
      where: {
        id: { in: emailIds },
        gmailAccount: {
          userId: session.user.id,
        },
      },
      include: {
        gmailAccount: true,
      },
    });

    if (emails.length !== emailIds.length) {
      return NextResponse.json(
        { error: "Some emails not found or unauthorized" },
        { status: 404 }
      );
    }

    // Filter out already unsubscribed
    const toUnsubscribe = emails.filter((e) => !e.unsubscribedAt);

    if (toUnsubscribe.length === 0) {
      return NextResponse.json(
        { error: "All emails already unsubscribed" },
        { status: 400 }
      );
    }

    logger.info("Starting bulk unsubscribe", {
      count: toUnsubscribe.length,
      userId: session.user.id,
    });

    // Get user email for the process
    const userEmail = emails[0]?.gmailAccount.email;

    // Perform bulk unsubscribe
    const results = await bulkUnsubscribe(
      toUnsubscribe.map((e) => e.id),
      userEmail
    );

    // Format response
    const responseData = {
      total: toUnsubscribe.length,
      successful: 0,
      failed: 0,
      results: [] as Array<{
        emailId: string;
        success: boolean;
        message: string;
        from: string;
        subject: string;
      }>,
    };

    toUnsubscribe.forEach((email) => {
      const result = results.get(email.id);
      if (result) {
        if (result.success) {
          responseData.successful++;
        } else {
          responseData.failed++;
        }

        responseData.results.push({
          emailId: email.id,
          success: result.success,
          message: result.message,
          from: email.from,
          subject: email.subject || "No Subject",
        });
      }
    });

    return NextResponse.json(responseData);
  } catch (error) {
    logger.error("Bulk unsubscribe API error", { error });
    return NextResponse.json(
      { error: "Failed to process bulk unsubscribe" },
      { status: 500 }
    );
  }
}
