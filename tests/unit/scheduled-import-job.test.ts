/**
 * Unit tests for Scheduled Import Job Processor
 */

import { Job } from "bullmq";

// Mock Anthropic BEFORE imports
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

// Mock dependencies BEFORE imports
jest.mock("@/lib/gmail/client");
jest.mock("@/lib/queue/queues", () => ({
  queueEmailImport: jest.fn(),
}));
jest.mock("@/lib/db/prisma", () => {
  const mockPrisma = {
    gmailAccount: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    email: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

// Import AFTER mocking
import { processScheduledImportJob } from "@/lib/queue/jobs/scheduled-import-job";
import { getGmailApi } from "@/lib/gmail/client";
import { queueEmailImport } from "@/lib/queue/queues";
import prisma from "@/lib/db/prisma";

describe("Scheduled Import Job", () => {
  let mockJob: Partial<Job>;
  let mockGmailApi: {
    users: {
      messages: {
        list: jest.Mock;
      };
      history: {
        list: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      id: "scheduled-job-123",
      data: {},
      updateProgress: jest.fn(),
    };

    mockGmailApi = {
      users: {
        messages: {
          list: jest.fn(),
        },
        history: {
          list: jest.fn(),
        },
        getProfile: jest.fn(),
      },
    };

    (getGmailApi as jest.Mock).mockResolvedValue(mockGmailApi);
  });

  describe("processScheduledImport", () => {
    it("should import new emails from all active accounts", async () => {
      // Mock active Gmail accounts
      (prisma.gmailAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: "account-1",
          email: "user1@example.com",
          userId: "user-123",
          syncStatus: "active",
          historyId: null,
        },
        {
          id: "account-2",
          email: "user2@example.com",
          userId: "user-123",
          syncStatus: "active",
          historyId: null,
        },
      ]);

      // Mock Gmail list messages
      mockGmailApi.users.messages.list.mockResolvedValue({
        data: {
          messages: [{ id: "msg-1" }, { id: "msg-2" }],
          resultSizeEstimate: 2,
        },
      });

      mockGmailApi.users.getProfile.mockResolvedValue({
        data: { historyId: "54321" },
      });

      // Mock no existing emails
      (prisma.email.findMany as jest.Mock).mockResolvedValue([]);

      await processScheduledImportJob(mockJob as Job);

      // Verify Gmail API was called for both accounts
      expect(mockGmailApi.users.messages.list).toHaveBeenCalledTimes(2);

      // Verify emails were queued for import
      expect(queueEmailImport).toHaveBeenCalledTimes(4); // 2 messages × 2 accounts
      expect(queueEmailImport).toHaveBeenCalledWith({
        accountId: "account-1",
        messageId: "msg-1",
        userId: "user-123",
      });
    });

    it("should use History API when historyId exists", async () => {
      (prisma.gmailAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: "account-1",
          email: "user1@example.com",
          userId: "user-123",
          syncStatus: "active",
          historyId: "12345",
        },
      ]);

      mockGmailApi.users.history.list.mockResolvedValue({
        data: {
          history: [
            {
              messagesAdded: [
                { message: { id: "msg-new-1" } },
                { message: { id: "msg-new-2" } },
              ],
            },
          ],
          historyId: "12346",
        },
      });

      (prisma.email.findMany as jest.Mock).mockResolvedValue([]);

      await processScheduledImportJob(mockJob as Job);

      expect(mockGmailApi.users.history.list).toHaveBeenCalledWith({
        userId: "me",
        startHistoryId: "12345",
        historyTypes: ["messageAdded"],
        maxResults: 100,
      });

      expect(queueEmailImport).toHaveBeenCalledTimes(2);
      expect(prisma.gmailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-1" },
        data: { historyId: "12346" },
      });
    });

    it("should skip existing emails", async () => {
      (prisma.gmailAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: "account-1",
          email: "user1@example.com",
          syncStatus: "active",
        },
      ]);

      mockGmailApi.users.messages.list.mockResolvedValue({
        data: {
          messages: [{ id: "msg-existing" }],
        },
      });

      // Mock email already exists
      (prisma.email.findMany as jest.Mock).mockResolvedValue({
        id: "existing-email",
        gmailMessageId: "msg-existing",
      });

      await processScheduledImportJob(mockJob as Job);

      expect(queueEmailImport).not.toHaveBeenCalled();
    });

    it("should handle accounts with no new messages", async () => {
      (prisma.gmailAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: "account-1",
          email: "user1@example.com",
          syncStatus: "active",
        },
      ]);

      mockGmailApi.users.messages.list.mockResolvedValue({
        data: {
          messages: [],
        },
      });

      await processScheduledImportJob(mockJob as Job);

      expect(queueEmailImport).not.toHaveBeenCalled();
    });

    it("should process all accounts (no sync status filtering)", async () => {
      (prisma.gmailAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: "account-1",
          email: "user1@example.com",
          userId: "user-123",
          syncStatus: "paused",
          historyId: null,
        },
      ]);

      mockGmailApi.users.messages.list.mockResolvedValue({
        data: {
          messages: [{ id: "msg-1" }],
          resultSizeEstimate: 1,
        },
      });

      (prisma.email.findMany as jest.Mock).mockResolvedValue([]);

      const result = await processScheduledImportJob(mockJob as Job);

      // Currently processes all accounts regardless of status
      expect(mockGmailApi.users.messages.list).toHaveBeenCalled();
      expect(result.accountsProcessed).toBe(1);
    });

    it("should handle Gmail API errors gracefully", async () => {
      (prisma.gmailAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: "account-1",
          email: "user1@example.com",
          userId: "user-123",
          syncStatus: "active",
        },
      ]);

      mockGmailApi.users.messages.list.mockRejectedValue(
        new Error("Gmail API error")
      );

      (prisma.email.findMany as jest.Mock).mockResolvedValue([]);

      const result = await processScheduledImportJob(mockJob as Job);

      // Should log error but not throw, and continue processing
      expect(result.success).toBe(true);
      expect(result.accountsProcessed).toBe(1);
      expect(result.emailsQueued).toBe(0);
    });

    it("should limit number of messages fetched", async () => {
      (prisma.gmailAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: "account-1",
          email: "user1@example.com",
          syncStatus: "active",
        },
      ]);

      mockGmailApi.users.messages.list.mockResolvedValue({
        data: {
          messages: Array(100)
            .fill(null)
            .map((_, i) => ({ id: `msg-${i}` })),
        },
      });

      (prisma.email.findMany as jest.Mock).mockResolvedValue(null);

      await processScheduledImportJob(mockJob as Job);

      // Verify maxResults was set
      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 50,
        })
      );
    });
  });
});
