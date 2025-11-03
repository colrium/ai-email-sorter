/**
 * Background Worker Process
 * Processes BullMQ jobs for email import, deletion, and Gmail watch management
 *
 * Run with: yarn worker
 */

import { Worker, Job } from "bullmq";
import {
  getRedisConnection,
  closeRedisConnection,
} from "./lib/queue/connection";
import { processEmailImportJob } from "./lib/queue/jobs/email-import-job";
import { processScheduledImportJob } from "./lib/queue/jobs/scheduled-import-job";
import { processBulkDeleteJob } from "./lib/queue/jobs/bulk-delete-job";
import { processGmailWatchJob } from "./lib/queue/jobs/gmail-watch-job";
import {
  EmailImportJobData,
  ScheduledImportJobData,
  EmailDeleteJobData,
  GmailWatchJobData,
  queueScheduledImport,
} from "./lib/queue/queues";
import { logger } from "./lib/utils/logger";

// Worker configuration
const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || "5", 10);

// Email Import Worker
const emailImportWorker = new Worker(
  "email-import",
  async (job: Job<EmailImportJobData>) => {
    return await processEmailImportJob(job);
  },
  {
    connection: getRedisConnection(),
    concurrency: CONCURRENCY,
  }
);

// Scheduled Import Worker
const scheduledImportWorker = new Worker(
  "scheduled-import",
  async (job: Job<ScheduledImportJobData>) => {
    return await processScheduledImportJob(job);
  },
  {
    connection: getRedisConnection(),
    concurrency: 1, // Only one scheduled import at a time
  }
);

// Email Delete Worker
const emailDeleteWorker = new Worker(
  "email-delete",
  async (job: Job<EmailDeleteJobData>) => {
    return await processBulkDeleteJob(job);
  },
  {
    connection: getRedisConnection(),
    concurrency: 2, // Allow multiple delete jobs
  }
);

// Gmail Watch Worker
const gmailWatchWorker = new Worker(
  "gmail-watch",
  async (job: Job<GmailWatchJobData>) => {
    return await processGmailWatchJob(job);
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  }
);

// Worker event handlers
const workers = [
  emailImportWorker,
  scheduledImportWorker,
  emailDeleteWorker,
  gmailWatchWorker,
];

workers.forEach((worker, index) => {
  const workerName = [
    "email-import",
    "scheduled-import",
    "email-delete",
    "gmail-watch",
  ][index];

  worker.on("completed", (job: Job) => {
    logger.info(`${workerName} job completed`, {
      jobId: job.id,
      returnValue: job.returnvalue,
    });
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    logger.error(`${workerName} job failed`, {
      jobId: job?.id,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on("error", (error: Error) => {
    logger.error(`${workerName} worker error`, { error: error.message });
  });

  worker.on("stalled", (jobId: string) => {
    logger.warn(`${workerName} job stalled`, { jobId });
  });
});

// Initialize scheduled import job on startup
async function initializeScheduledJobs() {
  try {
    logger.info("Initializing scheduled jobs...");

    // Queue scheduled import job (recurring)
    await queueScheduledImport();

    logger.info("Scheduled jobs initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize scheduled jobs", { error });
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down workers gracefully...");

  try {
    // Close all workers
    await Promise.all(workers.map((w) => w.close()));

    // Close Redis connection
    await closeRedisConnection();

    logger.info("All workers shut down successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", { error });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  shutdown();
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
  shutdown();
});

// Start workers
logger.info("Starting background workers...", {
  concurrency: CONCURRENCY,
  workers: workers.length,
});

// Initialize scheduled jobs after a short delay
setTimeout(() => {
  initializeScheduledJobs();
}, 2000);

logger.info("Background workers started successfully");
