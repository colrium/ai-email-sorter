import { jest } from "@jest/globals";

// Mock all dependencies
jest.mock("@/lib/gmail/fetch-emails", () => ({
  fetchEmails: jest.fn(),
  archiveEmail: jest.fn(),
}));

jest.mock("@/lib/ai/claude-client", () => ({
  categorizeEmail: jest.fn(),
  summarizeEmail: jest.fn(),
}));

jest.mock("@/lib/db/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    email: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Email Import Service", () => {
  let importEmails: typeof import("@/lib/services/email-import-service").importEmails;
  let getImportStatus: typeof import("@/lib/services/email-import-service").getImportStatus;
  let fetchEmails: jest.Mock;
  let categorizeEmail: jest.Mock;
  let summarizeEmail: jest.Mock;
  let archiveEmail: jest.Mock;
  let prisma: typeof import("@/lib/db/prisma").default;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import modules after mocks
    const importServiceModule = await import(
      "@/lib/services/email-import-service"
    );
    importEmails = importServiceModule.importEmails;
    getImportStatus = importServiceModule.getImportStatus;

    const gmailModule = await import("@/lib/gmail/fetch-emails");
    fetchEmails = gmailModule.fetchEmails as unknown as jest.Mock;
    archiveEmail = gmailModule.archiveEmail as unknown as jest.Mock;

    const claudeModule = await import("@/lib/ai/claude-client");
    categorizeEmail = claudeModule.categorizeEmail as unknown as jest.Mock;
    summarizeEmail = claudeModule.summarizeEmail as unknown as jest.Mock;

    const prismaModule = await import("@/lib/db/prisma");
    prisma = prismaModule.default;
  });

  describe("importEmails", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    const mockCategories = [
      { id: "cat-1", name: "Work", description: "Work emails" },
      { id: "cat-2", name: "Personal", description: "Personal emails" },
    ];

    const mockEmailData = [
      {
        gmailMessageId: "msg-1",
        threadId: "thread-1",
        subject: "Meeting Tomorrow",
        from: "boss@company.com",
        to: "test@example.com",
        date: new Date("2025-11-02"),
        snippet: "Please attend the meeting",
        bodyText: "We have a team meeting tomorrow at 2 PM.",
        bodyHtml: "<p>We have a team meeting tomorrow at 2 PM.</p>",
        labels: ["INBOX"],
        hasAttachments: false,
        unsubscribeLink: null,
      },
    ];

    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);
      (fetchEmails as jest.Mock).mockResolvedValue(mockEmailData);
      (categorizeEmail as jest.Mock).mockResolvedValue({
        categoryId: "cat-1",
        categoryName: "Work",
        confidence: 0.95,
        reasoning: "This is a work email",
      });
      (summarizeEmail as jest.Mock).mockResolvedValue(
        "Team meeting scheduled for tomorrow at 2 PM."
      );
      (prisma.email.findUnique as jest.Mock).mockResolvedValue(null); // No duplicates
      (prisma.email.create as jest.Mock).mockResolvedValue({
        id: "email-1",
        ...mockEmailData[0],
      });
      (prisma.category.update as jest.Mock).mockResolvedValue(
        mockCategories[0]
      );
      (archiveEmail as jest.Mock).mockResolvedValue(true);
    });

    it("should import emails successfully", async () => {
      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: true,
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(fetchEmails).toHaveBeenCalledWith("account-123", 10, undefined);
      expect(categorizeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Meeting Tomorrow",
          from: "boss@company.com",
        }),
        mockCategories
      );
      expect(summarizeEmail).toHaveBeenCalled();
      expect(prisma.email.create).toHaveBeenCalled();
      expect(archiveEmail).toHaveBeenCalledWith("account-123", "msg-1");
    });

    it("should skip duplicate emails", async () => {
      (prisma.email.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-email",
        gmailMessageId: "msg-1",
      });

      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
      });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(prisma.email.create).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully and continue processing", async () => {
      const multipleEmails = [
        { ...mockEmailData[0], gmailMessageId: "msg-1" },
        { ...mockEmailData[0], gmailMessageId: "msg-2" },
        { ...mockEmailData[0], gmailMessageId: "msg-3" },
      ];

      (fetchEmails as jest.Mock).mockResolvedValue(multipleEmails);

      // Make the second email fail
      (prisma.email.create as jest.Mock)
        .mockResolvedValueOnce({ id: "email-1" })
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce({ id: "email-3" });

      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
      });

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("msg-2");
    });

    it("should not archive if autoArchive is false", async () => {
      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
      });

      expect(result.success).toBe(true);
      expect(archiveEmail).not.toHaveBeenCalled();
    });

    it("should update category email count", async () => {
      await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
      });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { emailCount: { increment: 1 } },
      });
    });

    it("should throw error if user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        importEmails({
          accountId: "account-123",
          maxResults: 10,
          autoArchive: false,
        })
      ).rejects.toThrow("User not found");
    });

    it("should throw error if no categories exist", async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        importEmails({
          accountId: "account-123",
          maxResults: 10,
          autoArchive: false,
        })
      ).rejects.toThrow("No categories found");
    });

    it("should handle empty email list from Gmail", async () => {
      (fetchEmails as jest.Mock).mockResolvedValue([]);

      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
      });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("should use custom query parameter", async () => {
      await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
        query: "is:unread",
      });

      expect(fetchEmails).toHaveBeenCalledWith("account-123", 10, "is:unread");
    });

    it("should handle AI categorization failure", async () => {
      (categorizeEmail as jest.Mock).mockRejectedValue(
        new Error("AI service error")
      );

      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
      });

      // Should still process but may use fallback category
      expect(result.imported + result.failed).toBe(1);
    });

    it("should handle AI summarization failure", async () => {
      (summarizeEmail as jest.Mock).mockRejectedValue(
        new Error("AI service error")
      );

      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: false,
      });

      // Should still import with fallback summary
      expect(result.imported + result.failed).toBe(1);
    });
  });

  describe("getImportStatus", () => {
    it("should return import status", async () => {
      (prisma.email.findUnique as jest.Mock).mockImplementation(() => ({
        count: 42,
        lastImport: new Date("2025-11-02"),
      }));

      const status = await getImportStatus("account-123");

      expect(status).toEqual({
        totalEmails: expect.any(Number),
        lastImportAt: expect.any(Date),
      });
    });

    it("should handle account with no emails", async () => {
      (prisma.email.findUnique as jest.Mock).mockResolvedValue(null);

      const status = await getImportStatus("account-123");

      expect(status.totalEmails).toBe(0);
      expect(status.lastImportedAt).toBeNull();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle batch import with mixed results", async () => {
      const mockEmailData = [
        {
          gmailMessageId: "msg-1",
          threadId: "thread-1",
          subject: "Test Email",
          from: "test@example.com",
          to: "recipient@example.com",
          date: new Date("2025-11-02"),
          snippet: "Test snippet",
          bodyText: "Test body",
          bodyHtml: "<p>Test body</p>",
          labels: ["INBOX"],
          hasAttachments: false,
          unsubscribeLink: null,
        },
      ];

      const mixedEmails = [
        { ...mockEmailData[0], gmailMessageId: "new-1" },
        { ...mockEmailData[0], gmailMessageId: "duplicate-1" },
        { ...mockEmailData[0], gmailMessageId: "new-2" },
        { ...mockEmailData[0], gmailMessageId: "error-1" },
      ];

      (fetchEmails as jest.Mock).mockResolvedValue(mixedEmails);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-123",
      });
      (prisma.category.findMany as jest.Mock).mockResolvedValue([
        { id: "cat-1", name: "Test" },
      ]);

      (prisma.email.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // new-1: not duplicate
        .mockResolvedValueOnce({ id: "exists" }) // duplicate-1: is duplicate
        .mockResolvedValueOnce(null) // new-2: not duplicate
        .mockResolvedValueOnce(null); // error-1: not duplicate

      (prisma.email.create as jest.Mock)
        .mockResolvedValueOnce({ id: "1" }) // new-1: success
        .mockResolvedValueOnce({ id: "2" }) // new-2: success
        .mockRejectedValueOnce(new Error("DB error")); // error-1: fail

      (categorizeEmail as jest.Mock).mockResolvedValue({
        categoryId: "cat-1",
        categoryName: "Test",
        confidence: 0.8,
        reasoning: "Test",
      });
      (summarizeEmail as jest.Mock).mockResolvedValue("Summary");
      (archiveEmail as jest.Mock).mockResolvedValue(true);

      const result = await importEmails({
        accountId: "account-123",
        maxResults: 10,
        autoArchive: true,
      });

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(true);
    });
  });
});
