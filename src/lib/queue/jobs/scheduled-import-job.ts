/**
 * Scheduled Import Job Processor
 * Runs periodically to import new emails from all active Gmail accounts
 */

import { Job } from "bullmq";
import { ScheduledImportJobData, queueEmailImport } from "../queues";
import { prisma } from "@/lib/db/prisma";
import { getGmailApi } from "@/lib/gmail/client";
import { logger } from "@/lib/utils/logger";
import type { gmail_v1 } from "googleapis";

/**
 * Process scheduled import job
 * Checks all active Gmail accounts for new emails
 */
export async function processScheduledImportJob(
  job: Job<ScheduledImportJobData>
) {
  logger.info("Processing scheduled import job", { jobId: job.id });

  try {
    // Get all Gmail accounts
    const accounts = await prisma.gmailAccount.findMany({
      include: { user: true },
    });

    if (accounts.length === 0) {
      logger.info("No active Gmail accounts found");
      return { success: true, accountsProcessed: 0, emailsQueued: 0 };
    }

    let totalEmailsQueued = 0;

    // Process each account
    for (const account of accounts) {
      try {
        logger.info("Checking account for new emails", {
          accountId: account.id,
          email: account.email,
        });

        // Create Gmail API client
        const gmail = await getGmailApi(account.id);

        // Use history API if we have a historyId, otherwise list recent messages
        let messageIds: string[] = [];

        if (account.historyId) {
          // Use history API for incremental sync
          try {
            const historyResponse = await gmail.users.history.list({
              userId: "me",
              startHistoryId: account.historyId,
              historyTypes: ["messageAdded"],
              maxResults: 100,
            });

            if (historyResponse.data.history) {
              messageIds = historyResponse.data.history
                .flatMap((h: gmail_v1.Schema$History) => h.messagesAdded || [])
                .map((m: gmail_v1.Schema$HistoryMessageAdded) => m.message?.id)
                .filter((id): id is string => !!id);
            }

            // Update historyId for next sync
            if (historyResponse.data.historyId) {
              await prisma.gmailAccount.update({
                where: { id: account.id },
                data: { historyId: historyResponse.data.historyId },
              });
            }
          } catch (historyError) {
            // If history API fails, fall back to listing recent messages
            logger.warn("History API failed, falling back to list", {
              accountId: account.id,
              error: historyError,
            });
            account.historyId = null;
          }
        }

        if (!account.historyId) {
          // List recent unread messages in inbox
          const listResponse = await gmail.users.messages.list({
            userId: "me",
            q: "in:inbox is:unread",
            maxResults: 50,
          });

          messageIds =
            listResponse.data.messages?.map(
              (m: gmail_v1.Schema$Message) => m.id || ""
            ) || [];

          // Save historyId for future incremental syncs
          if (listResponse.data.resultSizeEstimate !== undefined) {
            const profile = await gmail.users.getProfile({ userId: "me" });
            if (profile.data.historyId) {
              await prisma.gmailAccount.update({
                where: { id: account.id },
                data: { historyId: profile.data.historyId },
              });
            }
          }
        }

        // Filter out already imported emails
        const existingEmails = await prisma.email.findMany({
          where: {
            gmailAccountId: account.id,
            gmailMessageId: { in: messageIds },
          },
          select: { gmailMessageId: true },
        });

        const existingIds = new Set(
          existingEmails.map(
            (e: { gmailMessageId: string }) => e.gmailMessageId
          )
        );
        const newMessageIds = messageIds.filter((id) => !existingIds.has(id));

        logger.info("Found new emails", {
          accountId: account.id,
          total: messageIds.length,
          new: newMessageIds.length,
          alreadyImported: existingIds.size,
        });

        // Queue import jobs for new emails
        for (const messageId of newMessageIds) {
          await queueEmailImport({
            accountId: account.id,
            messageId,
            userId: account.userId,
          });
          totalEmailsQueued++;
        }
      } catch (accountError) {
        logger.error("Failed to process account", {
          accountId: account.id,
          error: accountError,
        });
        // Continue with next account
      }
    }

    logger.info("Scheduled import job completed", {
      jobId: job.id,
      accountsProcessed: accounts.length,
      emailsQueued: totalEmailsQueued,
    });

    return {
      success: true,
      accountsProcessed: accounts.length,
      emailsQueued: totalEmailsQueued,
    };
  } catch (error) {
    logger.error("Scheduled import job failed", {
      jobId: job.id,
      error,
    });
    throw error;
  }
}
