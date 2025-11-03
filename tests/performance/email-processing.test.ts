/**
 * Performance Tests for Email Processing
 * Tests system performance with large email volumes
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

const prisma = new PrismaClient();

describe("Email Processing Performance Tests", () => {
  let testUserId: string;
  let testAccountId: string;
  let testCategoryIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "performance-test@example.com",
        name: "Performance Test User",
      },
    });
    testUserId = user.id;

    // Create Gmail account
    const account = await prisma.gmailAccount.create({
      data: {
        userId: testUserId,
        email: "performance@gmail.com",
        accessToken: "test-token",
        refreshToken: "test-refresh",

      },
    });
    testAccountId = account.id;

    // Create test categories
    const categories = await Promise.all([
      prisma.category.create({
        data: { userId: testUserId, name: "Work", color: "#FF0000" },
      }),
      prisma.category.create({
        data: { userId: testUserId, name: "Personal", color: "#00FF00" },
      }),
      prisma.category.create({
        data: { userId: testUserId, name: "Newsletters", color: "#0000FF" },
      }),
    ]);
    testCategoryIds = categories.map((c) => c.id);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.email.deleteMany({ where: { gmailAccountId: testAccountId } });
    await prisma.category.deleteMany({ where: { userId: testUserId } });
    await prisma.gmailAccount.delete({ where: { id: testAccountId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe("Bulk Email Import Performance", () => {
    it("should import 100 emails within 5 minutes", async () => {
      const emailCount = 100;
      const maxDuration = 5 * 60 * 1000; // 5 minutes in milliseconds

      const emails = Array.from({ length: emailCount }, (_, i) => ({
        gmailAccountId: testAccountId,
        gmailMessageId: `perf-test-${i}`,
        subject: `Performance Test Email ${i}`,
        from: `sender${i}@example.com`,
        date: new Date(Date.now() - i * 1000),
        bodyText: `This is test email number ${i} with some content.`,
        categoryId: testCategoryIds[i % 3],
      }));

      const startTime = performance.now();

      // Batch insert for performance
      await prisma.email.createMany({ data: emails });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(maxDuration);
      console.log(
        `Imported ${emailCount} emails in ${(duration / 1000).toFixed(2)}s`
      );

      // Verify all emails were imported
      const count = await prisma.email.count({
        where: { gmailAccountId: testAccountId },
      });
      expect(count).toBe(emailCount);
    }, 300000); // 5 minute timeout

    it("should handle 1000 emails efficiently", async () => {
      const emailCount = 1000;
      const batchSize = 100;

      const startTime = performance.now();

      // Insert in batches
      for (let batch = 0; batch < emailCount / batchSize; batch++) {
        const emails = Array.from({ length: batchSize }, (_, i) => ({
          gmailAccountId: testAccountId,
          gmailMessageId: `bulk-${batch}-${i}`,
          subject: `Bulk Test ${batch * batchSize + i}`,
          from: "bulk@example.com",
          date: new Date(),
        }));

        await prisma.email.createMany({ data: emails });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(
        `Imported ${emailCount} emails in ${(duration / 1000).toFixed(2)}s`
      );
      expect(duration).toBeLessThan(10 * 60 * 1000); // Less than 10 minutes
    }, 600000); // 10 minute timeout
  });

  describe("Email Categorization Performance", () => {
    it("should categorize 100 emails efficiently", async () => {
      // Create uncategorized emails
      const emailCount = 100;
      const emails = Array.from({ length: emailCount }, (_, i) => ({
        gmailAccountId: testAccountId,
        gmailMessageId: `categorize-${i}`,
        subject: `Email ${i}`,
        from: "sender@example.com",
        date: new Date(),
      }));

      await prisma.email.createMany({ data: emails });

      const startTime = performance.now();

      // Simulate categorization (update all emails with categories)
      const uncategorized = await prisma.email.findMany({
        where: {
          gmailAccountId: testAccountId,
          gmailMessageId: { startsWith: "categorize-" },
        },
      });

      await Promise.all(
        uncategorized.map((email, i) =>
          prisma.email.update({
            where: { id: email.id },
            data: { categoryId: testCategoryIds[i % 3] },
          })
        )
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(60000); // Less than 1 minute
      console.log(
        `Categorized ${emailCount} emails in ${(duration / 1000).toFixed(2)}s`
      );
    }, 120000); // 2 minute timeout
  });

  describe("Query Performance", () => {
    it("should query emails with pagination efficiently", async () => {
      // Create 500 test emails
      const emailCount = 500;
      const emails = Array.from({ length: emailCount }, (_, i) => ({
        gmailAccountId: testAccountId,
        gmailMessageId: `query-${i}`,
        subject: `Query Test ${i}`,
        from: "query@example.com",
        date: new Date(Date.now() - i * 1000),
        categoryId: testCategoryIds[i % 3],
      }));

      await prisma.email.createMany({ data: emails });

      const startTime = performance.now();

      // Fetch with pagination
      const page1 = await prisma.email.findMany({
        where: { gmailAccountId: testAccountId },
        take: 20,
        skip: 0,
        orderBy: { date: "desc" },
        include: { category: true },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(page1).toHaveLength(20);
      expect(duration).toBeLessThan(1000); // Less than 1 second
      console.log(`Queried 20 emails from 500 in ${duration.toFixed(2)}ms`);
    });

    it("should filter emails by category efficiently", async () => {
      const startTime = performance.now();

      const filtered = await prisma.email.findMany({
        where: {
          gmailAccountId: testAccountId,
          categoryId: testCategoryIds[0],
        },
        take: 50,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(filtered.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Less than 500ms
      console.log(`Filtered query took ${duration.toFixed(2)}ms`);
    });

    it("should perform full-text search efficiently", async () => {
      const startTime = performance.now();

      const searchResults = await prisma.email.findMany({
        where: {
          gmailAccountId: testAccountId,
          OR: [
            { subject: { contains: "Test", mode: "insensitive" } },
            { bodyText: { contains: "Test", mode: "insensitive" } },
          ],
        },
        take: 20,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000); // Less than 2 seconds
      console.log(`Full-text search took ${duration.toFixed(2)}ms`);
    });

    it("should aggregate email counts efficiently", async () => {
      const startTime = performance.now();

      const aggregation = await prisma.email.groupBy({
        by: ["categoryId"],
        _count: { id: true },
        where: { gmailAccountId: testAccountId },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(aggregation.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Less than 1 second
      console.log(`Aggregation query took ${duration.toFixed(2)}ms`);
    });
  });

  describe("Bulk Operations Performance", () => {
    it("should bulk delete 100 emails efficiently", async () => {
      // Create emails to delete
      const emailCount = 100;
      const emails = Array.from({ length: emailCount }, (_, i) => ({
        gmailAccountId: testAccountId,
        gmailMessageId: `delete-${i}`,
        subject: `Delete Test ${i}`,
        from: "delete@example.com",
        date: new Date(),
      }));

      await prisma.email.createMany({ data: emails });

      const startTime = performance.now();

      // Bulk delete
      const result = await prisma.email.deleteMany({
        where: {
          gmailAccountId: testAccountId,
          gmailMessageId: { startsWith: "delete-" },
        },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.count).toBe(emailCount);
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      console.log(
        `Bulk deleted ${emailCount} emails in ${(duration / 1000).toFixed(2)}s`
      );
    });

    it("should bulk update 100 emails efficiently", async () => {
      // Create emails to update
      const emailCount = 100;
      const emails = Array.from({ length: emailCount }, (_, i) => ({
        gmailAccountId: testAccountId,
        gmailMessageId: `update-${i}`,
        subject: `Update Test ${i}`,
        from: "update@example.com",
        date: new Date(),
      }));

      await prisma.email.createMany({ data: emails });

      const startTime = performance.now();

      // Bulk update
      const result = await prisma.email.updateMany({
        where: {
          gmailAccountId: testAccountId,
          gmailMessageId: { startsWith: "update-" },
        },
        data: {
          categoryId: testCategoryIds[0],
        },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.count).toBe(emailCount);
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      console.log(
        `Bulk updated ${emailCount} emails in ${(duration / 1000).toFixed(2)}s`
      );
    });
  });

  describe("Memory Usage", () => {
    it("should not leak memory during large operations", async () => {
      const iterations = 10;
      const memoryUsages: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Create and delete emails
        const emails = Array.from({ length: 100 }, (_, j) => ({
          gmailAccountId: testAccountId,
          gmailMessageId: `memory-${i}-${j}`,
          subject: `Memory Test ${i}-${j}`,
          from: "memory@example.com",
          date: new Date(),
        }));

        await prisma.email.createMany({ data: emails });
        await prisma.email.deleteMany({
          where: { gmailMessageId: { startsWith: `memory-${i}-` } },
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        memoryUsages.push(memUsage);

        console.log(`Iteration ${i + 1}: ${memUsage.toFixed(2)} MB`);
      }

      // Memory should not grow significantly
      const firstMemory = memoryUsages[0];
      const lastMemory = memoryUsages[memoryUsages.length - 1];
      const growth = ((lastMemory - firstMemory) / firstMemory) * 100;

      console.log(`Memory growth: ${growth.toFixed(2)}%`);
      expect(growth).toBeLessThan(50); // Less than 50% growth
    }, 120000); // 2 minute timeout
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent email queries", async () => {
      const concurrentQueries = 10;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentQueries }, () =>
        prisma.email.findMany({
          where: { gmailAccountId: testAccountId },
          take: 20,
          orderBy: { date: "desc" },
        })
      );

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(concurrentQueries);
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      console.log(
        `${concurrentQueries} concurrent queries in ${(duration / 1000).toFixed(
          2
        )}s`
      );
    });

    it("should handle concurrent writes", async () => {
      const concurrentWrites = 5;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentWrites }, (_, i) =>
        prisma.email.createMany({
          data: Array.from({ length: 10 }, (_, j) => ({
            gmailAccountId: testAccountId,
            gmailMessageId: `concurrent-${i}-${j}`,
            subject: `Concurrent ${i}-${j}`,
            from: "concurrent@example.com",
            date: new Date(),
          })),
        })
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Less than 10 seconds
      console.log(
        `${concurrentWrites} concurrent writes in ${(duration / 1000).toFixed(
          2
        )}s`
      );
    });
  });

  describe("Index Utilization", () => {
    it("should use indexes for common queries", async () => {
      // This test would require EXPLAIN ANALYZE in real PostgreSQL
      // Here we just verify query performance as a proxy

      const startTime = performance.now();

      await prisma.email.findFirst({
        where: {
          gmailAccountId: testAccountId,
          gmailMessageId: "query-1",
        },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be very fast with index
      expect(duration).toBeLessThan(100); // Less than 100ms
      console.log(`Indexed query took ${duration.toFixed(2)}ms`);
    });

    it("should efficiently query by date range", async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const startTime = performance.now();

      const recentEmails = await prisma.email.findMany({
        where: {
          gmailAccountId: testAccountId,
          date: { gte: lastWeek },
        },
        take: 50,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Less than 1 second
      console.log(
        `Date range query returned ${
          recentEmails.length
        } emails in ${duration.toFixed(2)}ms`
      );
    });
  });

  describe("Overall System Performance", () => {
    it("should complete full email processing workflow within limits", async () => {
      const emailCount = 100;
      const maxDuration = 5 * 60 * 1000; // 5 minutes

      const startTime = performance.now();

      // 1. Import emails
      const emails = Array.from({ length: emailCount }, (_, i) => ({
        gmailAccountId: testAccountId,
        gmailMessageId: `workflow-${i}`,
        subject: `Workflow Test ${i}`,
        from: `workflow${i}@example.com`,
        date: new Date(),
      }));
      await prisma.email.createMany({ data: emails });

      // 2. Query and categorize
      const imported = await prisma.email.findMany({
        where: { gmailMessageId: { startsWith: "workflow-" } },
      });

      await Promise.all(
        imported.map((email, i) =>
          prisma.email.update({
            where: { id: email.id },
            data: { categoryId: testCategoryIds[i % 3] },
          })
        )
      );

      // 3. Query with filters
      await prisma.email.findMany({
        where: {
          gmailAccountId: testAccountId,
          categoryId: testCategoryIds[0],
        },
      });

      // 4. Cleanup
      await prisma.email.deleteMany({
        where: { gmailMessageId: { startsWith: "workflow-" } },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(maxDuration);
      console.log(
        `Complete workflow for ${emailCount} emails: ${(
          duration / 1000
        ).toFixed(2)}s`
      );
    }, 300000); // 5 minute timeout
  });
});
