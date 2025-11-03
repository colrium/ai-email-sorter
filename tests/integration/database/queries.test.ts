/**
 * Integration Tests for Database Queries
 * Tests complex Prisma queries and database operations
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Database Queries Integration Tests", () => {
  let testUserId: string;
  let testGmailAccountId: string;
  let testCategoryIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "test-db@example.com",
        name: "Test DB User",
      },
    });
    testUserId = user.id;

    // Create Gmail account
    const gmailAccount = await prisma.gmailAccount.create({
      data: {
        userId: testUserId,
        email: "test-db@gmail.com",
        accessToken: "encrypted",
        refreshToken: "encrypted",

      },
    });
    testGmailAccountId = gmailAccount.id;

    // Create test categories
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          userId: testUserId,
          name: "Work",
          description: "Work emails",
          color: "#FF0000",
        },
      }),
      prisma.category.create({
        data: {
          userId: testUserId,
          name: "Personal",
          description: "Personal emails",
          color: "#00FF00",
        },
      }),
      prisma.category.create({
        data: {
          userId: testUserId,
          name: "Newsletters",
          description: "Newsletter emails",
          color: "#0000FF",
        },
      }),
    ]);
    testCategoryIds = categories.map((c) => c.id);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.email.deleteMany({
      where: { gmailAccountId: testGmailAccountId },
    });
    await prisma.category.deleteMany({ where: { userId: testUserId } });
    await prisma.gmailAccount.delete({ where: { id: testGmailAccountId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean emails before each test
    await prisma.email.deleteMany({
      where: { gmailAccountId: testGmailAccountId },
    });
  });

  describe("Complex Email Queries", () => {
    it("should query emails with category join", async () => {
      await prisma.email.create({
        data: {
          gmailAccountId: testGmailAccountId,
          categoryId: testCategoryIds[0],
          gmailMessageId: "msg1",
          subject: "Test Email",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      const emails = await prisma.email.findMany({
        where: { gmailAccountId: testGmailAccountId },
        include: {
          category: true,
        },
      });

      expect(emails).toHaveLength(1);
      expect(emails[0].category?.name).toBe("Work");
    });

    it("should aggregate emails by category", async () => {
      // Create emails in different categories
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryIds[0],
            gmailMessageId: "work1",
            subject: "Work 1",
            from: "work@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryIds[0],
            gmailMessageId: "work2",
            subject: "Work 2",
            from: "work@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryIds[1],
            gmailMessageId: "personal1",
            subject: "Personal 1",
            from: "friend@test.com",
            date: new Date(),
          },
        ],
      });

      const aggregation = await prisma.email.groupBy({
        by: ["categoryId"],
        _count: {
          id: true,
        },
        where: {
          gmailAccountId: testGmailAccountId,
        },
      });

      expect(aggregation).toHaveLength(2);
      const workCount = aggregation.find(
        (a) => a.categoryId === testCategoryIds[0]
      );
      const personalCount = aggregation.find(
        (a) => a.categoryId === testCategoryIds[1]
      );

      expect(workCount?._count.id).toBe(2);
      expect(personalCount?._count.id).toBe(1);
    });

    it("should query emails with date range filter", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "today",
            subject: "Today",
            from: "sender@test.com",
            date: now,
          },
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "yesterday",
            subject: "Yesterday",
            from: "sender@test.com",
            date: yesterday,
          },
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "lastweek",
            subject: "Last Week",
            from: "sender@test.com",
            date: lastWeek,
          },
        ],
      });

      // Get emails from last 3 days
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const recentEmails = await prisma.email.findMany({
        where: {
          gmailAccountId: testGmailAccountId,
          date: {
            gte: threeDaysAgo,
          },
        },
      });

      expect(recentEmails).toHaveLength(2);
    });

    it("should perform full-text search on emails", async () => {
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "search1",
            subject: "Important Meeting Tomorrow",
            from: "boss@test.com",
            bodyText: "Please attend the meeting about the project",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "search2",
            subject: "Newsletter",
            from: "news@test.com",
            bodyText: "Latest updates and news",
            date: new Date(),
          },
        ],
      });

      // Search for emails containing "meeting"
      const searchResults = await prisma.email.findMany({
        where: {
          gmailAccountId: testGmailAccountId,
          OR: [
            { subject: { contains: "meeting", mode: "insensitive" } },
            { bodyText: { contains: "meeting", mode: "insensitive" } },
          ],
        },
      });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].subject).toContain("Meeting");
    });

    it("should query emails with sender filter", async () => {
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "from1",
            subject: "Email 1",
            from: "alice@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "from2",
            subject: "Email 2",
            from: "bob@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "from3",
            subject: "Email 3",
            from: "alice@test.com",
            date: new Date(),
          },
        ],
      });

      const aliceEmails = await prisma.email.findMany({
        where: {
          gmailAccountId: testGmailAccountId,
          from: "alice@test.com",
        },
      });

      expect(aliceEmails).toHaveLength(2);
    });
  });

  describe("Category Email Count", () => {
    it("should accurately count emails per category", async () => {
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryIds[0],
            gmailMessageId: "c1-1",
            subject: "C1",
            from: "test@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryIds[0],
            gmailMessageId: "c1-2",
            subject: "C1",
            from: "test@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryIds[1],
            gmailMessageId: "c2-1",
            subject: "C2",
            from: "test@test.com",
            date: new Date(),
          },
        ],
      });

      const categoriesWithCount = await prisma.category.findMany({
        where: { userId: testUserId },
        include: {
          _count: {
            select: { emails: true },
          },
        },
      });

      const workCategory = categoriesWithCount.find((c) => c.name === "Work");
      const personalCategory = categoriesWithCount.find(
        (c) => c.name === "Personal"
      );

      expect(workCategory?._count.emails).toBe(2);
      expect(personalCategory?._count.emails).toBe(1);
    });

    it("should handle categories with no emails", async () => {
      const categoriesWithCount = await prisma.category.findMany({
        where: { userId: testUserId },
        include: {
          _count: {
            select: { emails: true },
          },
        },
      });

      const newslettersCategory = categoriesWithCount.find(
        (c) => c.name === "Newsletters"
      );
      expect(newslettersCategory?._count.emails).toBe(0);
    });
  });

  describe("Multi-Account Queries", () => {
    it("should query emails across multiple Gmail accounts", async () => {
      // Create second Gmail account
      const account2 = await prisma.gmailAccount.create({
        data: {
          userId: testUserId,
          email: "second@gmail.com",
          accessToken: "encrypted",
          refreshToken: "encrypted",

        },
      });

      // Create emails in both accounts
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "acc1-1",
            subject: "Account 1 Email 1",
            from: "sender@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: account2.id,
            gmailMessageId: "acc2-1",
            subject: "Account 2 Email 1",
            from: "sender@test.com",
            date: new Date(),
          },
        ],
      });

      // Query all emails for user across accounts
      const allUserEmails = await prisma.email.findMany({
        where: {
          gmailAccount: {
            userId: testUserId,
          },
        },
      });

      expect(allUserEmails).toHaveLength(2);

      // Cleanup
      await prisma.email.deleteMany({ where: { gmailAccountId: account2.id } });
      await prisma.gmailAccount.delete({ where: { id: account2.id } });
    });

    it("should get all categories with email counts across accounts", async () => {
      const account2 = await prisma.gmailAccount.create({
        data: {
          userId: testUserId,
          email: "third@gmail.com",
          accessToken: "encrypted",
          refreshToken: "encrypted",

        },
      });

      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryIds[0],
            gmailMessageId: "multi1",
            subject: "M1",
            from: "test@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: account2.id,
            categoryId: testCategoryIds[0],
            gmailMessageId: "multi2",
            subject: "M2",
            from: "test@test.com",
            date: new Date(),
          },
        ],
      });

      const categories = await prisma.category.findMany({
        where: { userId: testUserId },
        include: {
          _count: {
            select: { emails: true },
          },
        },
      });

      const workCategory = categories.find((c) => c.name === "Work");
      expect(workCategory?._count.emails).toBe(2); // Count across both accounts

      // Cleanup
      await prisma.email.deleteMany({ where: { gmailAccountId: account2.id } });
      await prisma.gmailAccount.delete({ where: { id: account2.id } });
    });
  });

  describe("Performance and Indexing", () => {
    it("should efficiently query large email sets", async () => {
      // Create 100 test emails
      const emails = Array.from({ length: 100 }, (_, i) => ({
        gmailAccountId: testGmailAccountId,
        gmailMessageId: `perf-${i}`,
        subject: `Performance Test ${i}`,
        from: `sender${i % 10}@test.com`,
        date: new Date(Date.now() - i * 1000),
        categoryId: testCategoryIds[i % 3],
      }));

      await prisma.email.createMany({ data: emails });

      const start = Date.now();

      const result = await prisma.email.findMany({
        where: {
          gmailAccountId: testGmailAccountId,
          categoryId: testCategoryIds[0],
        },
        take: 20,
        orderBy: { date: "desc" },
      });

      const duration = Date.now() - start;

      expect(result.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it("should use pagination efficiently", async () => {
      // Create 50 emails
      const emails = Array.from({ length: 50 }, (_, i) => ({
        gmailAccountId: testGmailAccountId,
        gmailMessageId: `page-${i}`,
        subject: `Page Test ${i}`,
        from: "sender@test.com",
        date: new Date(Date.now() - i * 1000),
      }));

      await prisma.email.createMany({ data: emails });

      // Get page 1
      const page1 = await prisma.email.findMany({
        where: { gmailAccountId: testGmailAccountId },
        take: 10,
        skip: 0,
        orderBy: { date: "desc" },
      });

      // Get page 2
      const page2 = await prisma.email.findMany({
        where: { gmailAccountId: testGmailAccountId },
        take: 10,
        skip: 10,
        orderBy: { date: "desc" },
      });

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe("Transaction Support", () => {
    it("should handle database transactions", async () => {
      await prisma.$transaction(async (tx) => {
        const email = await tx.email.create({
          data: {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "transaction-test",
            subject: "Transaction Test",
            from: "sender@test.com",
            date: new Date(),
          },
        });

        await tx.email.update({
          where: { id: email.id },
          data: { subject: "Updated in Transaction" },
        });
      });

      const email = await prisma.email.findFirst({
        where: { gmailMessageId: "transaction-test" },
      });

      expect(email?.subject).toBe("Updated in Transaction");
    });

    it("should rollback on transaction failure", async () => {
      const initialCount = await prisma.email.count({
        where: { gmailAccountId: testGmailAccountId },
      });

      try {
        await prisma.$transaction(async (tx) => {
          await tx.email.create({
            data: {
              gmailAccountId: testGmailAccountId,
              gmailMessageId: "rollback-test",
              subject: "Should Rollback",
              from: "sender@test.com",
              date: new Date(),
            },
          });

          // Force an error
          throw new Error("Transaction failed");
        });
      } catch {
        // Expected error
      }

      const finalCount = await prisma.email.count({
        where: { gmailAccountId: testGmailAccountId },
      });

      expect(finalCount).toBe(initialCount); // No new emails should be added
    });
  });

  describe("Unique Constraints", () => {
    it("should enforce unique gmail message ID per account", async () => {
      await prisma.email.create({
        data: {
          gmailAccountId: testGmailAccountId,
          gmailMessageId: "unique-test",
          subject: "Original",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      // Try to create duplicate
      await expect(
        prisma.email.create({
          data: {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "unique-test",
            subject: "Duplicate",
            from: "sender@test.com",
            date: new Date(),
          },
        })
      ).rejects.toThrow();
    });

    it("should allow same message ID across different accounts", async () => {
      const account2 = await prisma.gmailAccount.create({
        data: {
          userId: testUserId,
          email: "unique-test@gmail.com",
          accessToken: "encrypted",
          refreshToken: "encrypted",

        },
      });

      // Create email with same message ID in different accounts
      await prisma.email.create({
        data: {
          gmailAccountId: testGmailAccountId,
          gmailMessageId: "shared-id",
          subject: "Account 1",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      await prisma.email.create({
        data: {
          gmailAccountId: account2.id,
          gmailMessageId: "shared-id",
          subject: "Account 2",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      const emails = await prisma.email.findMany({
        where: { gmailMessageId: "shared-id" },
      });

      expect(emails).toHaveLength(2);

      // Cleanup
      await prisma.email.deleteMany({ where: { gmailAccountId: account2.id } });
      await prisma.gmailAccount.delete({ where: { id: account2.id } });
    });
  });
});
