/**
 * Email Import Job Processor
 * Handles background processing of email imports from Gmail
 */

import { Job } from "bullmq";
import { EmailImportJobData } from "../queues";
import { prisma } from "@/lib/db/prisma";
import { getGmailApi } from "@/lib/gmail/client";
import { categorizeEmail, summarizeEmail } from "@/lib/ai/claude-client";
import { logger } from "@/lib/utils/logger";
import type { gmail_v1 } from "googleapis";

/**
 * Process a single email import job
 */
export async function processEmailImportJob(job: Job<EmailImportJobData>) {
  const { accountId, messageId, userId } = job.data;

  logger.info("Processing email import job", {
    jobId: job.id,
    accountId,
    messageId,
  });

  try {
    // Update job progress
    await job.updateProgress(10);

    // Get Gmail account
    const gmailAccount = await prisma.gmailAccount.findUnique({
      where: { id: accountId },
      include: { user: true },
    });

    if (!gmailAccount) {
      throw new Error(`Gmail account not found: ${accountId}`);
    }

    // Create Gmail API client
    const gmail = await getGmailApi(accountId);

    await job.updateProgress(20);

    // Fetch email from Gmail
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;

    if (!message) {
      throw new Error("Failed to fetch email from Gmail");
    }

    await job.updateProgress(40);

    // Parse email headers
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find(
        (h: gmail_v1.Schema$MessagePartHeader) =>
          h.name?.toLowerCase() === name.toLowerCase()
      )?.value;

    const subject = getHeader("subject") || "(No Subject)";
    const from = getHeader("from") || "";
    const to = getHeader("to") || "";
    const date = getHeader("date") || "";

    // Parse email body
    let bodyText = "";
    let bodyHtml = "";

    const getBody = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.body?.data) {
        const decoded = Buffer.from(part.body.data, "base64").toString("utf-8");
        if (part.mimeType === "text/plain") {
          bodyText += decoded;
        } else if (part.mimeType === "text/html") {
          bodyHtml += decoded;
        }
      }
      if (part.parts) {
        part.parts.forEach(getBody);
      }
    };

    if (message.payload) {
      getBody(message.payload);
    }

    // Check if email already exists
    const existingEmail = await prisma.email.findUnique({
      where: {
        gmailAccountId_gmailMessageId: {
          gmailAccountId: accountId,
          gmailMessageId: messageId,
        },
      },
    });

    if (existingEmail) {
      logger.info("Email already imported, skipping", { messageId });
      return { success: true, skipped: true };
    }

    await job.updateProgress(50);

    // Get user's categories for AI categorization
    const categories = await prisma.category.findMany({
      where: { userId },
    });

    if (categories.length === 0) {
      throw new Error("No categories found for user");
    }

    // AI categorization
    const categorization = await categorizeEmail(
      {
        subject,
        bodyText: bodyText || message.snippet || "",
        from,
        snippet: message.snippet || "",
      },
      categories
    );

    await job.updateProgress(70);

    // AI summarization
    const summary = await summarizeEmail({
      subject,
      bodyText: bodyText || message.snippet || "",
      from,
    });

    await job.updateProgress(80);

    // Check for unsubscribe link
    const unsubscribeHeader = getHeader("list-unsubscribe");
    let unsubscribeUrl = null;

    if (unsubscribeHeader) {
      const match = unsubscribeHeader.match(/<(https?:\/\/[^>]+)>/);
      if (match) {
        unsubscribeUrl = match[1];
      }
    }

    // Save email to database
    const email = await prisma.email.create({
      data: {
        gmailAccountId: accountId,
        categoryId: categorization.categoryId,
        gmailMessageId: messageId,
        gmailThreadId: message.threadId || null,
        subject,
        from,
        fromName: from.split("<")[0].trim(),
        to,
        date: date ? new Date(date) : new Date(),
        bodyText,
        bodyHtml,
        snippet: message.snippet || null,
        aiSummary: summary,
        aiCategorizationReasoning: categorization.reasoning,
        unsubscribeLink: unsubscribeUrl,
        listUnsubscribeHeader: unsubscribeHeader,
        processingStatus: "completed",
        processedAt: new Date(),
      },
    });

    await job.updateProgress(90);

    // Archive email in Gmail (remove from inbox)
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        removeLabelIds: ["INBOX"],
      },
    });

    // Update email record
    await prisma.email.update({
      where: { id: email.id },
      data: { isArchivedInGmail: true },
    });

    // Update category count (only if categorized)
    if (categorization.categoryId) {
      await prisma.category.update({
        where: { id: categorization.categoryId },
        data: { emailCount: { increment: 1 } },
      });
    }

    await job.updateProgress(100);

    logger.info("Email import job completed", {
      jobId: job.id,
      emailId: email.id,
      categoryId: categorization.categoryId,
    });

    return {
      success: true,
      emailId: email.id,
      categoryId: categorization.categoryId,
    };
  } catch (error) {
    logger.error("Email import job failed", {
      jobId: job.id,
      error,
      accountId,
      messageId,
    });

    // Save error to database
    try {
      await prisma.email.upsert({
        where: {
          gmailAccountId_gmailMessageId: {
            gmailAccountId: accountId,
            gmailMessageId: messageId,
          },
        },
        create: {
          gmailAccountId: accountId,
          gmailMessageId: messageId,
          gmailThreadId: null,
          subject: "(Failed to import)",
          from: "",
          date: new Date(),
          processingStatus: "failed",
          processingError:
            error instanceof Error ? error.message : String(error),
        },
        update: {
          processingStatus: "failed",
          processingError:
            error instanceof Error ? error.message : String(error),
        },
      });
    } catch (dbError) {
      logger.error("Failed to save error to database", { dbError });
    }

    throw error;
  }
}
