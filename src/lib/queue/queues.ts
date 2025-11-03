/**
 * BullMQ Queue Definitions
 * Defines all job queues used in the application
 */

import { Queue, QueueOptions } from "bullmq";
import { getRedisConnection } from "./connection";
import { logger } from "@/lib/utils/logger";

// Queue configuration
const QUEUE_OPTIONS: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: parseInt(process.env.JOB_RETRY_ATTEMPTS || "3", 10),
    backoff: {
      type: "exponential",
      delay: parseInt(process.env.JOB_RETRY_DELAY || "5000", 10),
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Email Import Queue - Processes individual email imports
export const emailImportQueue = new Queue("email-import", QUEUE_OPTIONS);

// Scheduled Import Queue - Runs periodic imports for all accounts
export const scheduledImportQueue = new Queue(
  "scheduled-import",
  QUEUE_OPTIONS
);

// Email Delete Queue - Handles bulk email deletions
export const emailDeleteQueue = new Queue("email-delete", QUEUE_OPTIONS);

// Gmail Watch Queue - Manages Gmail watch renewals
export const gmailWatchQueue = new Queue("gmail-watch", QUEUE_OPTIONS);

// Log queue initialization
logger.info("BullMQ queues initialized", {
  queues: ["email-import", "scheduled-import", "email-delete", "gmail-watch"],
});

/**
 * Job Types for TypeScript type safety
 */
export interface EmailImportJobData {
  accountId: string;
  messageId: string;
  userId: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ScheduledImportJobData {
  // No data needed - processes all active accounts
}

export interface EmailDeleteJobData {
  emailIds: string[];
  userId: string;
}

export interface GmailWatchJobData {
  accountId: string;
  userId: string;
}

/**
 * Add email import job to queue
 */
export async function queueEmailImport(data: EmailImportJobData) {
  try {
    const job = await emailImportQueue.add("import-email", data, {
      jobId: `import-${data.accountId}-${data.messageId}`,
      removeOnComplete: true,
    });

    logger.info("Email import job queued", {
      jobId: job.id,
      accountId: data.accountId,
      messageId: data.messageId,
    });

    return job;
  } catch (error) {
    logger.error("Failed to queue email import job", { error, data });
    throw error;
  }
}

/**
 * Add scheduled import job (runs for all accounts)
 */
export async function queueScheduledImport() {
  try {
    const job = await scheduledImportQueue.add(
      "scheduled-import",
      {},
      {
        repeat: {
          pattern: process.env.EMAIL_IMPORT_SCHEDULE || "*/5 * * * *", // Every 5 minutes
        },
        jobId: "scheduled-import-recurring",
      }
    );

    logger.info("Scheduled import job configured", {
      jobId: job.id,
      schedule: process.env.EMAIL_IMPORT_SCHEDULE || "*/5 * * * *",
    });

    return job;
  } catch (error) {
    logger.error("Failed to queue scheduled import job", { error });
    throw error;
  }
}

/**
 * Add bulk delete job to queue
 */
export async function queueBulkDelete(data: EmailDeleteJobData) {
  try {
    const job = await emailDeleteQueue.add("bulk-delete", data);

    logger.info("Bulk delete job queued", {
      jobId: job.id,
      emailCount: data.emailIds.length,
    });

    return job;
  } catch (error) {
    logger.error("Failed to queue bulk delete job", { error, data });
    throw error;
  }
}

/**
 * Add Gmail watch renewal job
 */
export async function queueGmailWatch(data: GmailWatchJobData) {
  try {
    const job = await gmailWatchQueue.add("renew-watch", data, {
      repeat: {
        every: 6 * 24 * 60 * 60 * 1000, // Every 6 days
      },
      jobId: `watch-${data.accountId}`,
    });

    logger.info("Gmail watch renewal job queued", {
      jobId: job.id,
      accountId: data.accountId,
    });

    return job;
  } catch (error) {
    logger.error("Failed to queue Gmail watch job", { error, data });
    throw error;
  }
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  try {
    const [
      emailImportCounts,
      scheduledImportCounts,
      emailDeleteCounts,
      gmailWatchCounts,
    ] = await Promise.all([
      emailImportQueue.getJobCounts(),
      scheduledImportQueue.getJobCounts(),
      emailDeleteQueue.getJobCounts(),
      gmailWatchQueue.getJobCounts(),
    ]);

    return {
      emailImport: emailImportCounts,
      scheduledImport: scheduledImportCounts,
      emailDelete: emailDeleteCounts,
      gmailWatch: gmailWatchCounts,
    };
  } catch (error) {
    logger.error("Failed to get queue metrics", { error });
    throw error;
  }
}

/**
 * Close all queues gracefully
 */
export async function closeQueues() {
  logger.info("Closing all queues...");

  await Promise.all([
    emailImportQueue.close(),
    scheduledImportQueue.close(),
    emailDeleteQueue.close(),
    gmailWatchQueue.close(),
  ]);

  logger.info("All queues closed");
}
