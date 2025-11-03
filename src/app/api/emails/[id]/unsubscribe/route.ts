/**
 * API Route: Single Email Unsubscribe
 * POST /api/emails/[id]/unsubscribe
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { unsubscribeFromEmail } from "@/lib/services/unsubscribe-service";
import { prisma } from "@/lib/db/prisma";
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

    const { id: emailId } = await params;

    // Verify email belongs to user
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        gmailAccount: {
          userId: session.user.id,
        },
      },
      include: {
        gmailAccount: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (email.unsubscribedAt) {
      return NextResponse.json(
        { error: "Already unsubscribed from this email" },
        { status: 400 }
      );
    }

    logger.info("Starting unsubscribe process", {
      emailId,
      userId: session.user.id,
    });

    // Perform unsubscribe
    const result = await unsubscribeFromEmail(
      emailId,
      email.gmailAccount.email
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      steps: result.steps,
      emailId,
    });
  } catch (error) {
    logger.error("Unsubscribe API error", { error });
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
