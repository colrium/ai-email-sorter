/**
 * API Route: Refresh Gmail Account
 * POST /api/accounts/[id]/refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { queueScheduledImport } from "@/lib/queue/queues";
import { logger } from "@/lib/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: accountId } = await params;

    // Verify account belongs to user
    const account = await prisma.gmailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Queue a sync job for this account
    await queueScheduledImport();

    logger.info("Account refresh queued", {
      userId: session.user.id,
      accountId,
    });

    return NextResponse.json({
      success: true,
      message: "Email sync queued",
    });
  } catch (error) {
    logger.error("Failed to refresh account", { error });
    return NextResponse.json(
      { error: "Failed to refresh account" },
      { status: 500 }
    );
  }
}
