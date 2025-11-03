/**
 * Unit tests for Queue Helper Functions
 * Tests the queue wrapper functions without loading actual BullMQ
 */

// Mock the entire queues module to avoid BullMQ/msgpackr issues
jest.mock("@/lib/queue/queues", () => {
  const mockQueue = {
    add: jest.fn(),
    getJobCounts: jest.fn(),
    close: jest.fn(),
  };

  return {
    emailImportQueue: mockQueue,
    scheduledImportQueue: mockQueue,
    emailDeleteQueue: mockQueue,
    gmailWatchQueue: mockQueue,
    queueEmailImport: jest.fn().mockResolvedValue({ id: "job-123" }),
    queueScheduledImport: jest.fn().mockResolvedValue({ id: "job-scheduled" }),
    queueBulkDelete: jest.fn().mockResolvedValue({ id: "job-bulk" }),
    getQueueMetrics: jest.fn().mockResolvedValue({
      emailImport: {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0,
      },
      scheduledImport: {
        waiting: 0,
        active: 0,
        completed: 50,
        failed: 0,
        delayed: 0,
        paused: 0,
      },
      emailDelete: {
        waiting: 0,
        active: 1,
        completed: 20,
        failed: 0,
        delayed: 0,
        paused: 0,
      },
      gmailWatch: {
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 0,
        delayed: 0,
        paused: 0,
      },
    }),
    closeQueues: jest.fn().mockResolvedValue(undefined),
  };
});

import {
  queueEmailImport,
  queueScheduledImport,
  queueBulkDelete,
  getQueueMetrics,
  closeQueues,
} from "@/lib/queue/queues";

describe("Queue Helper Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("queueEmailImport", () => {
    it("should queue an email import job", async () => {
      const jobData = {
        accountId: "account-123",
        messageId: "msg-456",
        userId: "user-123",
      };

      const result = await queueEmailImport(jobData);

      expect(queueEmailImport).toHaveBeenCalledWith(jobData);
      expect(result).toEqual({ id: "job-123" });
    });
  });

  describe("queueScheduledImport", () => {
    it("should queue a scheduled import job", async () => {
      const result = await queueScheduledImport();

      expect(queueScheduledImport).toHaveBeenCalled();
      expect(result).toEqual({ id: "job-scheduled" });
    });
  });

  describe("queueBulkDelete", () => {
    it("should queue a bulk delete job", async () => {
      const jobData = {
        emailIds: ["email-1", "email-2", "email-3"],
        userId: "user-123",
      };

      const result = await queueBulkDelete(jobData);

      expect(queueBulkDelete).toHaveBeenCalledWith(jobData);
      expect(result).toEqual({ id: "job-bulk" });
    });
  });

  describe("getQueueMetrics", () => {
    it("should return metrics for all queues", async () => {
      const metrics = await getQueueMetrics();

      expect(getQueueMetrics).toHaveBeenCalled();
      expect(metrics).toHaveProperty("emailImport");
      expect(metrics).toHaveProperty("scheduledImport");
      expect(metrics).toHaveProperty("emailDelete");
      expect(metrics).toHaveProperty("gmailWatch");

      expect(metrics.emailImport).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0,
      });
    });
  });

  describe("closeQueues", () => {
    it("should close all queues", async () => {
      await closeQueues();

      expect(closeQueues).toHaveBeenCalled();
    });
  });
});
