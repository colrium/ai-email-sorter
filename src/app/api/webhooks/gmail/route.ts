/**
 * Gmail Webhook Handler
 * POST /api/webhooks/gmail
 * Receives push notifications from Gmail API
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

// Gmail sends push notifications as Pub/Sub messages
interface GmailPushNotification {
  message: {
    data: string; // Base64 encoded
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotificationData {
  emailAddress: string;
  historyId: string;
}

/**
 * POST /api/webhooks/gmail
 * Handle Gmail push notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Parse notification
    const notification: GmailPushNotification = await request.json();

    // Decode message data
    const decodedData = Buffer.from(
      notification.message.data,
      "base64"
    ).toString("utf-8");

    const data: GmailNotificationData = JSON.parse(decodedData);

    logger.info("Received Gmail push notification", {
      emailAddress: data.emailAddress,
      historyId: data.historyId,
    });

    // Find Gmail account by email address
    const account = await prisma.gmailAccount.findFirst({
      where: {
        email: data.emailAddress,
      },
      include: {
        user: true,
      },
    });

    if (!account) {
      logger.warn("Gmail account not found for notification", {
        emailAddress: data.emailAddress,
      });
      // Return 200 anyway to acknowledge receipt
      return NextResponse.json({ success: true });
    }

    // Check if historyId is newer
    if (account.historyId && data.historyId <= account.historyId) {
      logger.info("Ignoring old notification", {
        accountId: account.id,
        currentHistoryId: account.historyId,
        notificationHistoryId: data.historyId,
      });
      return NextResponse.json({ success: true });
    }

    // Update historyId
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: { historyId: data.historyId },
    });

    // Queue email import job
    // The scheduled import job will handle fetching new messages
    // using the history API with the new historyId
    logger.info("Triggering email import for account", {
      accountId: account.id,
      historyId: data.historyId,
    });

    // We could queue a specific history sync job here
    // For now, rely on scheduled imports to pick up changes

    return NextResponse.json({
      success: true,
      accountId: account.id,
      historyId: data.historyId,
    });
  } catch (error) {
    logger.error("Gmail webhook error", { error });

    // Still return 200 to prevent Gmail from retrying
    return NextResponse.json({
      success: false,
      error: "Internal error",
    });
  }
}

/**
 * GET /api/webhooks/gmail
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "gmail-webhook",
  });
}
