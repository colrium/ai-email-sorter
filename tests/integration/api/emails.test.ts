/**
 * Integration Tests for Emails API
 * Tests email operations and bulk actions with database integration
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import request from "supertest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

describe("Emails API Integration Tests", () => {
  let testUserId: string;
  let testGmailAccountId: string;
  let testCategoryId: string;
  let testEmailId: string;
  let authCookie: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "test-emails@example.com",
        name: "Test User",
      },
    });
    testUserId = user.id;
    authCookie = `next-auth.session-token=test-token-${testUserId}`;

    // Create test Gmail account
    const gmailAccount = await prisma.gmailAccount.create({
      data: {
        userId: testUserId,
        email: "test-gmail@gmail.com",
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",

      },
    });
    testGmailAccountId = gmailAccount.id;

    // Create test category
    const category = await prisma.category.create({
      data: {
        userId: testUserId,
        name: "Test Category",
        description: "For testing",
        color: "#FF0000",
      },
    });
    testCategoryId = category.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.email.deleteMany({
      where: { gmailAccountId: testGmailAccountId },
    });
    await prisma.category.delete({ where: { id: testCategoryId } });
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

  describe("GET /api/emails", () => {
    it("should return empty array for user with no emails", async () => {
      const response = await request(API_URL)
        .get("/api/emails")
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body.emails).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it("should return all emails for authenticated user", async () => {
      // Create test emails
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryId,
            gmailMessageId: "msg1",
            subject: "Test Email 1",
            from: "sender1@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryId,
            gmailMessageId: "msg2",
            subject: "Test Email 2",
            from: "sender2@test.com",
            date: new Date(),
          },
        ],
      });

      const response = await request(API_URL)
        .get("/api/emails")
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body.emails).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.emails[0]).toHaveProperty("id");
      expect(response.body.emails[0]).toHaveProperty("subject");
      expect(response.body.emails[0]).toHaveProperty("from");
    });

    it("should filter emails by category", async () => {
      const category2 = await prisma.category.create({
        data: {
          userId: testUserId,
          name: "Category 2",
          description: "Second category",
          color: "#00FF00",
        },
      });

      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            categoryId: testCategoryId,
            gmailMessageId: "msg-cat1",
            subject: "In Category 1",
            from: "sender@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            categoryId: category2.id,
            gmailMessageId: "msg-cat2",
            subject: "In Category 2",
            from: "sender@test.com",
            date: new Date(),
          },
        ],
      });

      const response = await request(API_URL)
        .get(`/api/emails?categoryId=${testCategoryId}`)
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body.emails).toHaveLength(1);
      expect(response.body.emails[0].subject).toBe("In Category 1");

      // Cleanup
      await prisma.category.delete({ where: { id: category2.id } });
    });

    it("should support pagination", async () => {
      // Create 15 test emails
      const emails = Array.from({ length: 15 }, (_, i) => ({
        gmailAccountId: testGmailAccountId,
        categoryId: testCategoryId,
        gmailMessageId: `msg-page-${i}`,
        subject: `Email ${i}`,
        from: "sender@test.com",
        date: new Date(Date.now() - i * 1000), // Different dates
      }));

      await prisma.email.createMany({ data: emails });

      // Get first page
      const page1 = await request(API_URL)
        .get("/api/emails?page=1&limit=10")
        .set("Cookie", authCookie)
        .expect(200);

      expect(page1.body.emails).toHaveLength(10);
      expect(page1.body.total).toBe(15);

      // Get second page
      const page2 = await request(API_URL)
        .get("/api/emails?page=2&limit=10")
        .set("Cookie", authCookie)
        .expect(200);

      expect(page2.body.emails).toHaveLength(5);
    });

    it("should return 401 for unauthenticated request", async () => {
      await request(API_URL).get("/api/emails").expect(401);
    });
  });

  describe("GET /api/emails/:id", () => {
    beforeEach(async () => {
      const email = await prisma.email.create({
        data: {
          gmailAccountId: testGmailAccountId,
          categoryId: testCategoryId,
          gmailMessageId: "single-email",
          subject: "Single Test Email",
          from: "sender@test.com",
          bodyHtml: "<p>HTML body</p>",
          bodyText: "Plain text body",
          date: new Date(),
        },
      });
      testEmailId = email.id;
    });

    it("should return email details", async () => {
      const response = await request(API_URL)
        .get(`/api/emails/${testEmailId}`)
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body.id).toBe(testEmailId);
      expect(response.body.subject).toBe("Single Test Email");
      expect(response.body.bodyHtml).toBe("<p>HTML body</p>");
      expect(response.body.bodyText).toBe("Plain text body");
    });

    it("should return 404 for non-existent email", async () => {
      await request(API_URL)
        .get("/api/emails/non-existent-id")
        .set("Cookie", authCookie)
        .expect(404);
    });

    it("should return 403 for email owned by different user", async () => {
      const otherUser = await prisma.user.create({
        data: { email: "other-email@example.com", name: "Other User" },
      });

      const otherGmailAccount = await prisma.gmailAccount.create({
        data: {
          userId: otherUser.id,
          email: "other@gmail.com",
          accessToken: "encrypted",
          refreshToken: "encrypted",

        },
      });

      const otherEmail = await prisma.email.create({
        data: {
          gmailAccountId: otherGmailAccount.id,
          gmailMessageId: "other-msg",
          subject: "Other Email",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      await request(API_URL)
        .get(`/api/emails/${otherEmail.id}`)
        .set("Cookie", authCookie)
        .expect(403);

      // Cleanup
      await prisma.email.delete({ where: { id: otherEmail.id } });
      await prisma.gmailAccount.delete({ where: { id: otherGmailAccount.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe("POST /api/emails/bulk-delete", () => {
    it("should delete multiple emails", async () => {
      // Create emails to delete
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "bulk-del-1",
            subject: "Delete 1",
            from: "sender@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "bulk-del-2",
            subject: "Delete 2",
            from: "sender@test.com",
            date: new Date(),
          },
        ],
      });

      const emailIds = await prisma.email.findMany({
        where: { gmailMessageId: { in: ["bulk-del-1", "bulk-del-2"] } },
        select: { id: true },
      });

      const response = await request(API_URL)
        .post("/api/emails/bulk-delete")
        .set("Cookie", authCookie)
        .send({ emailIds: emailIds.map((e) => e.id) })
        .expect(200);

      expect(response.body.deleted).toBe(2);

      // Verify deletion
      const remaining = await prisma.email.findMany({
        where: { id: { in: emailIds.map((e) => e.id) } },
      });
      expect(remaining).toHaveLength(0);
    });

    it("should return 400 for empty array", async () => {
      await request(API_URL)
        .post("/api/emails/bulk-delete")
        .set("Cookie", authCookie)
        .send({ emailIds: [] })
        .expect(400);
    });

    it("should only delete emails owned by user", async () => {
      const otherUser = await prisma.user.create({
        data: { email: "other2@example.com", name: "Other" },
      });

      const otherAccount = await prisma.gmailAccount.create({
        data: {
          userId: otherUser.id,
          email: "other2@gmail.com",
          accessToken: "encrypted",
          refreshToken: "encrypted",

        },
      });

      const otherEmail = await prisma.email.create({
        data: {
          gmailAccountId: otherAccount.id,
          gmailMessageId: "other-bulk",
          subject: "Other",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      const myEmail = await prisma.email.create({
        data: {
          gmailAccountId: testGmailAccountId,
          gmailMessageId: "my-bulk",
          subject: "Mine",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      // Try to delete both
      const response = await request(API_URL)
        .post("/api/emails/bulk-delete")
        .set("Cookie", authCookie)
        .send({ emailIds: [myEmail.id, otherEmail.id] })
        .expect(200);

      // Should only delete owned email
      expect(response.body.deleted).toBe(1);

      // Verify other email still exists
      const otherStillExists = await prisma.email.findUnique({
        where: { id: otherEmail.id },
      });
      expect(otherStillExists).toBeTruthy();

      // Cleanup
      await prisma.email.delete({ where: { id: otherEmail.id } });
      await prisma.gmailAccount.delete({ where: { id: otherAccount.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe("POST /api/emails/bulk-unsubscribe", () => {
    it("should queue unsubscribe jobs", async () => {
      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "unsub-1",
            subject: "Unsubscribe Me 1",
            from: "newsletter@test.com",
            bodyHtml: '<a href="https://test.com/unsubscribe">Unsubscribe</a>',
            date: new Date(),
          },
          {
            gmailAccountId: testGmailAccountId,
            gmailMessageId: "unsub-2",
            subject: "Unsubscribe Me 2",
            from: "marketing@test.com",
            bodyHtml: '<a href="https://test.com/optout">Opt-out</a>',
            date: new Date(),
          },
        ],
      });

      const emailIds = await prisma.email.findMany({
        where: { gmailMessageId: { in: ["unsub-1", "unsub-2"] } },
        select: { id: true },
      });

      const response = await request(API_URL)
        .post("/api/emails/bulk-unsubscribe")
        .set("Cookie", authCookie)
        .send({ emailIds: emailIds.map((e) => e.id) })
        .expect(200);

      expect(response.body.queued).toBe(2);
      expect(response.body.results).toHaveLength(2);
    });

    it("should return 400 for empty array", async () => {
      await request(API_URL)
        .post("/api/emails/bulk-unsubscribe")
        .set("Cookie", authCookie)
        .send({ emailIds: [] })
        .expect(400);
    });
  });

  describe("POST /api/emails/:id/unsubscribe", () => {
    beforeEach(async () => {
      const email = await prisma.email.create({
        data: {
          gmailAccountId: testGmailAccountId,
          gmailMessageId: "single-unsub",
          subject: "Newsletter",
          from: "news@test.com",
          bodyHtml: '<a href="https://test.com/unsubscribe">Unsubscribe</a>',
          date: new Date(),
        },
      });
      testEmailId = email.id;
    });

    it("should queue unsubscribe job for single email", async () => {
      const response = await request(API_URL)
        .post(`/api/emails/${testEmailId}/unsubscribe`)
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("queued");
    });

    it("should return 404 for non-existent email", async () => {
      await request(API_URL)
        .post("/api/emails/non-existent/unsubscribe")
        .set("Cookie", authCookie)
        .expect(404);
    });

    it("should return 400 if email already unsubscribed", async () => {
      await prisma.email.update({
        where: { id: testEmailId },
        data: { unsubscribedAt: new Date() },
      });

      await request(API_URL)
        .post(`/api/emails/${testEmailId}/unsubscribe`)
        .set("Cookie", authCookie)
        .expect(400);
    });
  });

  describe("POST /api/emails/import", () => {
    it("should queue email import job", async () => {
      const response = await request(API_URL)
        .post("/api/emails/import")
        .set("Cookie", authCookie)
        .send({ gmailAccountId: testGmailAccountId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBeTruthy();
    });

    it("should return 401 for unauthenticated request", async () => {
      await request(API_URL)
        .post("/api/emails/import")
        .send({ gmailAccountId: testGmailAccountId })
        .expect(401);
    });
  });
});
