/**
 * Gmail Watch Renewal Job Processor
 * Renews Gmail watch subscriptions before they expire
 */

import { Job } from "bullmq";
import { GmailWatchJobData } from "../queues";
import { prisma } from "@/lib/db/prisma";
import { setupGmailWatch } from "@/lib/gmail/watch-service";
import { logger } from "@/lib/utils/logger";

/**
 * Process Gmail watch renewal job
 */
export async function processGmailWatchJob(job: Job<GmailWatchJobData>) {
  const { accountId, userId } = job.data;

  logger.info("Processing Gmail watch renewal job", {
    jobId: job.id,
    accountId,
    userId,
  });

  try {
    // Get Gmail account
    const account = await prisma.gmailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      logger.warn("Gmail account not found for watch renewal", { accountId });
      return { success: false, reason: "account_not_found" };
    }

    // Renew watch subscription
    const result = await setupGmailWatch(accountId);

    logger.info("Gmail watch renewed successfully", {
      jobId: job.id,
      accountId,
      expiration: result.expiration,
    });

    return {
      success: true,
      expiration: result.expiration,
      historyId: result.historyId,
    };
  } catch (error) {
    logger.error("Gmail watch renewal job failed", {
      jobId: job.id,
      error,
      accountId,
      userId,
    });
    throw error;
  }
}
