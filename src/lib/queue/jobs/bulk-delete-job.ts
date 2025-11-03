/**
 * Bulk Delete Job Processor
 * Handles deletion of multiple emails at once
 */

import { Job } from "bullmq";
import { EmailDeleteJobData } from "../queues";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";

/**
 * Process bulk email delete job
 */
export async function processBulkDeleteJob(job: Job<EmailDeleteJobData>) {
  const { emailIds, userId } = job.data;

  logger.info("Processing bulk delete job", {
    jobId: job.id,
    emailCount: emailIds.length,
    userId,
  });

  try {
    // Use transaction to ensure all-or-nothing deletion
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Get emails to be deleted (with their category IDs)
        const emails = await tx.email.findMany({
          where: {
            id: { in: emailIds },
            gmailAccount: { userId },
          },
          select: {
            id: true,
            categoryId: true,
          },
        });

        if (emails.length === 0) {
          logger.warn("No emails found for deletion", { emailIds, userId });
          return { deleted: 0, categoryUpdates: {} };
        }

        // Count emails per category
        const categoryCounts = emails.reduce(
          (
            acc: Record<string, number>,
            email: { id: string; categoryId: string | null }
          ) => {
            if (email.categoryId) {
              acc[email.categoryId] = (acc[email.categoryId] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>
        );

        // Delete emails
        const deleteResult = await tx.email.deleteMany({
          where: {
            id: { in: emails.map((e: { id: string }) => e.id) },
          },
        });

        // Update category counts
        for (const [categoryId, count] of Object.entries(categoryCounts)) {
          await tx.category.update({
            where: { id: categoryId },
            data: {
              emailCount: {
                decrement: count,
              },
            },
          });
        }

        logger.info("Emails deleted successfully", {
          jobId: job.id,
          deletedCount: deleteResult.count,
          categoryUpdates: categoryCounts,
        });

        return {
          deleted: deleteResult.count,
          categoryUpdates: categoryCounts,
        };
      }
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    logger.error("Bulk delete job failed", {
      jobId: job.id,
      error,
      emailIds,
      userId,
    });
    throw error;
  }
}
