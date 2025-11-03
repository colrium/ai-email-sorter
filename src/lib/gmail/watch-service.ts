/**
 * Gmail Watch Service
 * Manages Gmail push notifications and watch renewals
 */

import { getGmailApi } from "./client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * Set up Gmail watch for push notifications
 * Watch expires after 7 days max, need to renew before then
 */
export async function setupGmailWatch(accountId: string) {
  try {
    logger.info("Setting up Gmail watch", { accountId });

    // Get Gmail API client
    const gmail = await getGmailApi(accountId);

    // Set up watch
    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: process.env.GMAIL_WATCH_TOPIC,
        labelIds: ["INBOX"], // Only watch inbox
        labelFilterAction: "include",
      },
    });

    if (!response.data.expiration || !response.data.historyId) {
      throw new Error("Invalid watch response from Gmail API");
    }

    const expiration = new Date(parseInt(response.data.expiration, 10));
    const historyId = response.data.historyId;

    // Update Gmail account with watch info
    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: {
        historyId,
        watchExpiration: expiration,
      },
    });

    logger.info("Gmail watch set up successfully", {
      accountId,
      expiration,
      historyId,
    });

    return {
      success: true,
      expiration,
      historyId,
    };
  } catch (error) {
    logger.error("Failed to set up Gmail watch", { error, accountId });
    throw error;
  }
}

/**
 * Stop Gmail watch
 */
export async function stopGmailWatch(accountId: string) {
  try {
    logger.info("Stopping Gmail watch", { accountId });

    const gmail = await getGmailApi(accountId);

    await gmail.users.stop({
      userId: "me",
    });

    // Clear watch info from database
    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: {
        watchExpiration: null,
      },
    });

    logger.info("Gmail watch stopped successfully", { accountId });

    return { success: true };
  } catch (error) {
    logger.error("Failed to stop Gmail watch", { error, accountId });
    throw error;
  }
}

/**
 * Check if watch needs renewal (expires in less than 24 hours)
 */
export async function checkWatchRenewal(accountId: string): Promise<boolean> {
  try {
    const account = await prisma.gmailAccount.findUnique({
      where: { id: accountId },
      select: { watchExpiration: true },
    });

    if (!account || !account.watchExpiration) {
      return true; // Needs setup
    }

    const now = new Date();
    const hoursUntilExpiry =
      (account.watchExpiration.getTime() - now.getTime()) / (1000 * 60 * 60);

    return hoursUntilExpiry < 24; // Renew if less than 24 hours left
  } catch (error) {
    logger.error("Failed to check watch renewal", { error, accountId });
    return true; // Assume needs renewal on error
  }
}

/**
 * Renew all expiring watches
 */
export async function renewExpiringWatches() {
  try {
    logger.info("Checking for expiring Gmail watches");

    // Get all accounts with watches expiring in next 24 hours
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const expiringAccounts = await prisma.gmailAccount.findMany({
      where: {
        watchExpiration: {
          lte: tomorrow,
        },
      },
    });

    logger.info("Found expiring watches", { count: expiringAccounts.length });

    const results = [];
    for (const account of expiringAccounts) {
      try {
        const result = await setupGmailWatch(account.id);
        results.push({ accountId: account.id, ...result });
      } catch (error) {
        logger.error("Failed to renew watch", { accountId: account.id, error });
        results.push({ accountId: account.id, success: false, error });
      }
    }

    return results;
  } catch (error) {
    logger.error("Failed to renew expiring watches", { error });
    throw error;
  }
}
