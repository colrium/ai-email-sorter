import { fetchEmails, archiveEmail } from "@/lib/gmail/fetch-emails";
import { categorizeEmail, summarizeEmail } from "@/lib/ai/claude-client";
import prisma from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

export interface ImportEmailsOptions {
  accountId: string;
  maxResults?: number;
  autoArchive?: boolean;
  query?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Import emails from Gmail, categorize, summarize, and optionally archive
 */
export async function importEmails(
  options: ImportEmailsOptions
): Promise<ImportResult> {
  const {
    accountId,
    maxResults = 20,
    autoArchive = true,
    query = "in:inbox",
  } = options;

  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    logger.info("Starting email import", { accountId, maxResults, query });

    // Verify account exists
    const account = await prisma.gmailAccount.findUnique({
      where: { id: accountId },
      include: { user: true },
    });

    if (!account) {
      throw new Error(`Gmail account not found: ${accountId}`);
    }

    // Fetch user's categories
    const categories = await prisma.category.findMany({
      where: { userId: account.userId },
      orderBy: { createdAt: "asc" },
    });

    if (categories.length === 0) {
      result.errors.push(
        "No categories found. Please create at least one category."
      );
      return result;
    }

    logger.info("Found categories", { count: categories.length });

    // Fetch emails from Gmail
    const { emails } = await fetchEmails(accountId, { maxResults, query });
    logger.info("Fetched emails from Gmail", { count: emails.length });

    // Process each email
    for (const emailData of emails) {
      try {
        // Check if email already exists
        const existingEmail = await prisma.email.findUnique({
          where: {
            gmailAccountId_gmailMessageId: {
              gmailAccountId: accountId,
              gmailMessageId: emailData.gmailMessageId,
            },
          },
        });

        if (existingEmail) {
          logger.info("Email already imported, skipping", {
            messageId: emailData.gmailMessageId,
          });
          result.skipped++;
          continue;
        }

        // Categorize email
        logger.info("Categorizing email", { subject: emailData.subject });
        const categorization = await categorizeEmail(
          {
            subject: emailData.subject,
            from: emailData.from,
            snippet: emailData.snippet,
            bodyText: emailData.bodyText,
          },
          categories
        );

        // Summarize email
        logger.info("Summarizing email", { subject: emailData.subject });
        const summary = await summarizeEmail({
          subject: emailData.subject,
          from: emailData.from,
          bodyText: emailData.bodyText,
        });

        // Save to database
        await prisma.email.create({
          data: {
            gmailAccountId: accountId,
            categoryId: categorization.categoryId,
            gmailMessageId: emailData.gmailMessageId,
            gmailThreadId: emailData.threadId,
            subject: emailData.subject,
            from: emailData.from,
            to: emailData.to,
            date: emailData.date,
            snippet: emailData.snippet,
            bodyText: emailData.bodyText,
            bodyHtml: emailData.bodyHtml,
            labels: emailData.labels,
            aiSummary: summary,
            aiCategorizationReasoning: `Category: ${categorization.categoryName}, Confidence: ${categorization.confidence}, Reason: ${categorization.reasoning}`,
            hasAttachments: emailData.hasAttachments,
            unsubscribeLink: emailData.unsubscribeLink,
            isArchivedInGmail: false,
            processingStatus: "completed",
          },
        });

        logger.info("Email saved to database", {
          messageId: emailData.gmailMessageId,
          category: categorization.categoryName,
        });

        // Archive in Gmail if enabled
        if (autoArchive) {
          const archived = await archiveEmail(
            accountId,
            emailData.gmailMessageId
          );
          if (archived) {
            await prisma.email.update({
              where: {
                gmailAccountId_gmailMessageId: {
                  gmailAccountId: accountId,
                  gmailMessageId: emailData.gmailMessageId,
                },
              },
              data: { isArchivedInGmail: true },
            });
            logger.info("Email archived in Gmail", {
              messageId: emailData.gmailMessageId,
            });
          }
        }

        // Update category email count
        await prisma.category.update({
          where: { id: categorization.categoryId },
          data: { emailCount: { increment: 1 } },
        });

        result.imported++;
      } catch (error) {
        logger.error("Failed to process email", {
          error,
          messageId: emailData.gmailMessageId,
        });
        result.failed++;
        result.errors.push(
          `Failed to import email: ${emailData.subject} - ${error}`
        );
      }
    }

    result.success = result.imported > 0;
    logger.info("Email import completed", {
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
    });

    return result;
  } catch (error) {
    logger.error("Email import failed", { error, accountId });
    result.errors.push(`Import failed: ${error}`);
    return result;
  }
}

/**
 * Get import status for an account
 */
export async function getImportStatus(accountId: string) {
  const emailCount = await prisma.email.count({
    where: { gmailAccountId: accountId },
  });

  const lastImport = await prisma.email.findFirst({
    where: { gmailAccountId: accountId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    totalEmails: emailCount,
    lastImportedAt: lastImport?.createdAt || null,
  };
}
