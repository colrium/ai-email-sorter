/**
 * Unit tests for Email Import Job Processor
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

// Mock dependencies
jest.mock("@/lib/gmail/client");
jest.mock("@/lib/ai/claude-client");

import { processEmailImportJob } from "@/lib/queue/jobs/email-import-job";
import { getGmailApi } from "@/lib/gmail/client";
import { categorizeEmail, summarizeEmail } from "@/lib/ai/claude-client";
jest.mock("@/lib/db/prisma", () => {
  const mockPrisma = {
    gmailAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    email: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

import prisma from "@/lib/db/prisma";

describe("Email Import Job", () => {
  let mockJob: Partial<Job>;
  let mockGmailApi: {
    users: {
      messages: {
        get: jest.Mock;
        modify: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      id: "job-123",
      data: {
        accountId: "account-123",
        messageId: "msg-456",
      },
      updateProgress: jest.fn(),
    };

    mockGmailApi = {
      users: {
        messages: {
          get: jest.fn(),
          modify: jest.fn(),
        },
      },
    };

    (getGmailApi as jest.Mock).mockResolvedValue(mockGmailApi);
  });

  describe("processEmailImport", () => {
    it("should successfully import and categorize an email", async () => {
      // Mock Gmail account
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue({
        id: "account-123",
        userId: "user-123",
        email: "test@example.com",
        accessToken: "encrypted-token",
        refreshToken: "encrypted-refresh",
      });

      // Mock email doesn't exist yet
      (prisma.email.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock Gmail API response
      mockGmailApi.users.messages.get.mockResolvedValue({
        data: {
          id: "msg-456",
          payload: {
            headers: [
              { name: "From", value: "sender@example.com" },
              { name: "To", value: "test@example.com" },
              { name: "Subject", value: "Test Email" },
              { name: "Date", value: "Mon, 1 Jan 2024 12:00:00 +0000" },
            ],
            body: {
              data: Buffer.from("Email body content").toString("base64"),
            },
          },
          internalDate: "1704110400000",
        },
      });

      // Mock categories
      (prisma.category.findMany as jest.Mock).mockResolvedValue([
        {
          id: "cat-1",
          name: "Work",
          description: "Work-related emails",
        },
      ]);

      // Mock AI categorization
      (categorizeEmail as jest.Mock).mockResolvedValue({
        categoryId: "cat-1",
        reasoning: "This is a work email",
      });

      // Mock AI summarization
      (summarizeEmail as jest.Mock).mockResolvedValue("Summary of the email");

      // Mock email creation
      (prisma.email.create as jest.Mock).mockResolvedValue({
        id: "email-123",
        gmailMessageId: "msg-456",
        subject: "Test Email",
      });

      // Mock Gmail modify (archive)
      mockGmailApi.users.messages.modify.mockResolvedValue({});

      await processEmailImportJob(mockJob as Job);

      // Verify Gmail API was called
      expect(mockGmailApi.users.messages.get).toHaveBeenCalledWith({
        userId: "me",
        id: "msg-456",
        format: "full",
      });

      // Verify AI was called
      expect(categorizeEmail).toHaveBeenCalled();
      expect(summarizeEmail).toHaveBeenCalled();

      // Verify email was saved
      expect(prisma.email.create).toHaveBeenCalled();

      // Verify category count was updated
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { emailCount: { increment: 1 } },
      });

      // Verify email was archived in Gmail
      expect(mockGmailApi.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: "msg-456",
        requestBody: {
          removeLabelIds: ["INBOX"],
        },
      });
    });

    it("should skip if email already exists", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue({
        id: "account-123",
        email: "test@example.com",
        userId: "user-123",
      });

      mockGmailApi.users.messages.get.mockResolvedValue({
        data: {
          id: "msg-456",
          payload: {
            headers: [
              { name: "From", value: "sender@example.com" },
              { name: "Subject", value: "Test" },
            ],
            body: { data: Buffer.from("Test").toString("base64") },
          },
          internalDate: "1704110400000",
        },
      });

      (prisma.email.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-email",
        gmailMessageId: "msg-456",
      });

      await processEmailImportJob(mockJob as Job);

      // Gmail API should be called to fetch the message
      expect(mockGmailApi.users.messages.get).toHaveBeenCalled();
      // But email should not be created since it already exists
      expect(prisma.email.create).not.toHaveBeenCalled();
    });

    it("should throw error if account not found", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(processEmailImportJob(mockJob as Job)).rejects.toThrow(
        "Gmail account not found"
      );
    });

    it("should handle Gmail API errors", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue({
        id: "account-123",
        email: "test@example.com",
      });

      (prisma.email.findUnique as jest.Mock).mockResolvedValue(null);

      mockGmailApi.users.messages.get.mockRejectedValue(
        new Error("Gmail API error")
      );

      await expect(processEmailImportJob(mockJob as Job)).rejects.toThrow(
        "Gmail API error"
      );
    });

    it("should handle emails without matching category", async () => {
      (prisma.gmailAccount.findUnique as jest.Mock).mockResolvedValue({
        id: "account-123",
        userId: "user-123",
        email: "test@example.com",
      });

      (prisma.email.findUnique as jest.Mock).mockResolvedValue(null);

      mockGmailApi.users.messages.get.mockResolvedValue({
        data: {
          id: "msg-456",
          payload: {
            headers: [
              { name: "From", value: "sender@example.com" },
              { name: "Subject", value: "Test" },
            ],
            body: { data: Buffer.from("Test").toString("base64") },
          },
          internalDate: "1704110400000",
        },
      });

      // Mock categories exist but AI returns null category
      (prisma.category.findMany as jest.Mock).mockResolvedValue([
        { id: "cat-1", name: "Work" },
      ]);
      (categorizeEmail as jest.Mock).mockResolvedValue({ categoryId: null });
      (summarizeEmail as jest.Mock).mockResolvedValue("Summary");
      (prisma.email.create as jest.Mock).mockResolvedValue({ id: "email-123" });
      (prisma.email.update as jest.Mock).mockResolvedValue({});
      mockGmailApi.users.messages.modify.mockResolvedValue({});

      await processEmailImportJob(mockJob as Job);

      expect(prisma.category.update).not.toHaveBeenCalled();
    });
  });
});
