/**
 * Unit tests for Gmail Watch Job Processor
 */

import { Job } from "bullmq";
import { processGmailWatchJob } from "@/lib/queue/jobs/gmail-watch-job";
import { setupGmailWatch } from "@/lib/gmail/watch-service";

// Mock dependencies
jest.mock("@/lib/gmail/watch-service");
jest.mock("@/lib/db/prisma", () => {
  const mockGmailAccount = {
    findUnique: jest.fn(),
  };
  return {
    __esModule: true,
    prisma: {
      gmailAccount: mockGmailAccount,
    },
    default: {
      gmailAccount: mockGmailAccount,
    },
  };
});

import { prisma } from "@/lib/db/prisma";

describe("Gmail Watch Job", () => {
  let mockJob: Partial<Job>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      id: "gmail-watch-job-123",
      data: {
        accountId: "account-123",
        userId: "user-123",
      },
      updateProgress: jest.fn(),
    };
  });

  describe("processGmailWatchJob", () => {
    it("should renew Gmail watch subscription successfully", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue({
        id: "account-123",
        userId: "user-123",
        email: "test@example.com",
      });

      const mockExpiration = new Date("2024-01-08T00:00:00Z");
      (setupGmailWatch as jest.Mock).mockResolvedValue({
        success: true,
        expiration: mockExpiration,
        historyId: "12345",
      });

      const result = await processGmailWatchJob(mockJob as Job);

      expect(setupGmailWatch).toHaveBeenCalledWith("account-123");
      expect(result).toEqual({
        success: true,
        expiration: mockExpiration,
        historyId: "12345",
      });
    });

    it("should return failure if account not found", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await processGmailWatchJob(mockJob as Job);

      expect(result).toEqual({
        success: false,
        reason: "account_not_found",
      });
      expect(setupGmailWatch).not.toHaveBeenCalled();
    });

    it("should handle watch setup errors", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue({
        id: "account-123",
        userId: "user-123",
        email: "test@example.com",
      });

      (setupGmailWatch as jest.Mock).mockRejectedValue(
        new Error("Gmail API error")
      );

      await expect(processGmailWatchJob(mockJob as Job)).rejects.toThrow(
        "Gmail API error"
      );
    });

    it("should pass correct account ID to setup function", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue({
        id: "account-456",
        userId: "user-123",
        email: "test2@example.com",
      });

      mockJob.data = {
        accountId: "account-456",
        userId: "user-123",
      };

      (setupGmailWatch as jest.Mock).mockResolvedValue({
        success: true,
        expiration: new Date(),
        historyId: "99999",
      });

      await processGmailWatchJob(mockJob as Job);

      expect(setupGmailWatch).toHaveBeenCalledWith("account-456");
    });
  });
});
