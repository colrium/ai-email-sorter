/**
 * Unit tests for Bulk Delete Job Processor
 */

import { Job } from "bullmq";
import { processBulkDeleteJob } from "@/lib/queue/jobs/bulk-delete-job";

// Mock Prisma module
jest.mock("@/lib/db/prisma", () => {
  const mockPrisma = {
    $transaction: jest.fn(),
    email: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    category: {
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

describe("Bulk Delete Job", () => {
  let mockJob: Partial<Job>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      id: "bulk-delete-job-123",
      data: {
        emailIds: ["email-1", "email-2", "email-3"],
        userId: "user-123",
      },
      updateProgress: jest.fn(),
    };
  });

  describe("processBulkDeleteJob", () => {
    it("should delete multiple emails in a transaction", async () => {
      const mockEmails = [
        { id: "email-1", categoryId: "cat-1" },
        { id: "email-2", categoryId: "cat-1" },
        { id: "email-3", categoryId: "cat-2" },
      ];

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback({
            email: {
              findMany: jest.fn().mockResolvedValue(mockEmails),
              deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
            },
            category: {
              update: jest.fn().mockResolvedValue({}),
            },
          });
        }
      );

      await processBulkDeleteJob(mockJob as Job);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should update category counts for affected categories", async () => {
      const mockEmails = [
        { id: "email-1", categoryId: "cat-1" },
        { id: "email-2", categoryId: "cat-1" },
        { id: "email-3", categoryId: "cat-2" },
      ];

      const mockTx = {
        email: {
          findMany: jest.fn().mockResolvedValue(mockEmails),
          deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
        category: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockTx);
        }
      );

      await processBulkDeleteJob(mockJob as Job);

      // Should update cat-1 (2 emails) and cat-2 (1 email)
      expect(mockTx.category.update).toHaveBeenCalledTimes(2);
      expect(mockTx.category.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { emailCount: { decrement: 2 } },
      });
      expect(mockTx.category.update).toHaveBeenCalledWith({
        where: { id: "cat-2" },
        data: { emailCount: { decrement: 1 } },
      });
    });

    it("should handle emails without categories", async () => {
      const mockEmails = [
        { id: "email-1", categoryId: null },
        { id: "email-2", categoryId: null },
      ];

      const mockTx = {
        email: {
          findMany: jest.fn().mockResolvedValue(mockEmails),
          deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        category: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockTx);
        }
      );

      await processBulkDeleteJob(mockJob as Job);

      expect(mockTx.category.update).not.toHaveBeenCalled();
    });

    it("should handle empty email list", async () => {
      mockJob.data = {
        emailIds: [],
        userId: "user-123",
      };

      const mockTx = {
        email: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        category: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockTx);
        }
      );

      await processBulkDeleteJob(mockJob as Job);

      expect(mockTx.email.findMany).toHaveBeenCalled();
      expect(mockTx.category.update).not.toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(processBulkDeleteJob(mockJob as Job)).rejects.toThrow(
        "Database error"
      );
    });

    it("should handle database errors gracefully", async () => {
      const mockTx = {
        email: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: "email-1", categoryId: "cat-1" }]),
          deleteMany: jest.fn().mockRejectedValue(new Error("Delete failed")),
        },
        category: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockTx);
        }
      );

      await expect(processBulkDeleteJob(mockJob as Job)).rejects.toThrow(
        "Delete failed"
      );
    });

    it("should group category updates correctly", async () => {
      const mockEmails = [
        { id: "email-1", categoryId: "cat-1" },
        { id: "email-2", categoryId: "cat-1" },
        { id: "email-3", categoryId: "cat-1" },
        { id: "email-4", categoryId: "cat-2" },
        { id: "email-5", categoryId: "cat-2" },
      ];

      const mockTx = {
        email: {
          findMany: jest.fn().mockResolvedValue(mockEmails),
          deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
        category: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return callback(mockTx);
        }
      );

      await processBulkDeleteJob(mockJob as Job);

      expect(mockTx.category.update).toHaveBeenCalledTimes(2);
      expect(mockTx.category.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { emailCount: { decrement: 3 } },
      });
      expect(mockTx.category.update).toHaveBeenCalledWith({
        where: { id: "cat-2" },
        data: { emailCount: { decrement: 2 } },
      });
    });
  });
});
