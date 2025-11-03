/**
 * Integration Tests for Categories API
 * Tests CRUD operations for categories with database integration
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

// Mock Next.js app URL - adjust based on your setup
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

describe("Categories API Integration Tests", () => {
  let testUserId: string;
  let testCategoryId: string;
  let authCookie: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "test-categories@example.com",
        name: "Test User",
      },
    });
    testUserId = user.id;

    // Mock auth cookie - in real test, this would come from auth flow
    authCookie = `next-auth.session-token=test-token-${testUserId}`;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.category.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean categories before each test
    await prisma.category.deleteMany({
      where: { userId: testUserId },
    });
  });

  describe("GET /api/categories", () => {
    it("should return empty array for user with no categories", async () => {
      const response = await request(API_URL)
        .get("/api/categories")
        .set("Cookie", authCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it("should return all categories for authenticated user", async () => {
      // Create test categories
      await prisma.category.createMany({
        data: [
          {
            userId: testUserId,
            name: "Work",
            description: "Work-related emails",
            color: "#FF0000",
          },
          {
            userId: testUserId,
            name: "Personal",
            description: "Personal emails",
            color: "#00FF00",
          },
        ],
      });

      const response = await request(API_URL)
        .get("/api/categories")
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty("id");
      expect(response.body[0]).toHaveProperty("name");
      expect(response.body[0]).toHaveProperty("description");
      expect(response.body[0]).toHaveProperty("color");
    });

    it("should return 401 for unauthenticated request", async () => {
      await request(API_URL).get("/api/categories").expect(401);
    });

    it("should include email count for each category", async () => {
      const category = await prisma.category.create({
        data: {
          userId: testUserId,
          name: "Test Category",
          description: "Test",
          color: "#FF0000",
        },
      });

      // Create test gmail account and emails
      const gmailAccount = await prisma.gmailAccount.create({
        data: {
          userId: testUserId,
          email: "test@gmail.com",
          accessToken: "encrypted-token",
          refreshToken: "encrypted-token",

        },
      });

      await prisma.email.createMany({
        data: [
          {
            gmailAccountId: gmailAccount.id,
            categoryId: category.id,
            gmailMessageId: "msg1",
            subject: "Test 1",
            from: "sender@test.com",
            date: new Date(),
          },
          {
            gmailAccountId: gmailAccount.id,
            categoryId: category.id,
            gmailMessageId: "msg2",
            subject: "Test 2",
            from: "sender@test.com",
            date: new Date(),
          },
        ],
      });

      const response = await request(API_URL)
        .get("/api/categories")
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body[0].emailCount).toBe(2);
    });
  });

  describe("POST /api/categories", () => {
    it("should create new category", async () => {
      const newCategory = {
        name: "Newsletters",
        description: "Marketing and newsletter emails",
        color: "#FF5733",
      };

      const response = await request(API_URL)
        .post("/api/categories")
        .set("Cookie", authCookie)
        .send(newCategory)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe(newCategory.name);
      expect(response.body.description).toBe(newCategory.description);
      expect(response.body.color).toBe(newCategory.color);
      expect(response.body.userId).toBe(testUserId);

      // Verify in database
      const dbCategory = await prisma.category.findUnique({
        where: { id: response.body.id },
      });
      expect(dbCategory).toBeTruthy();
      expect(dbCategory?.name).toBe(newCategory.name);
    });

    it("should return 400 for invalid data", async () => {
      await request(API_URL)
        .post("/api/categories")
        .set("Cookie", authCookie)
        .send({ name: "" }) // Missing description
        .expect(400);
    });

    it("should return 401 for unauthenticated request", async () => {
      await request(API_URL)
        .post("/api/categories")
        .send({ name: "Test", description: "Test" })
        .expect(401);
    });

    it("should prevent duplicate category names for same user", async () => {
      await prisma.category.create({
        data: {
          userId: testUserId,
          name: "Work",
          description: "Work emails",
          color: "#FF0000",
        },
      });

      await request(API_URL)
        .post("/api/categories")
        .set("Cookie", authCookie)
        .send({ name: "Work", description: "Duplicate", color: "#00FF00" })
        .expect(409); // Conflict
    });

    it("should allow same category name for different users", async () => {
      const otherUser = await prisma.user.create({
        data: { email: "other@example.com", name: "Other User" },
      });

      await prisma.category.create({
        data: {
          userId: testUserId,
          name: "Work",
          description: "Test",
          color: "#FF0000",
        },
      });

      // Different user can create same category name
      await prisma.category.create({
        data: {
          userId: otherUser.id,
          name: "Work",
          description: "Test",
          color: "#00FF00",
        },
      });

      const categories = await prisma.category.findMany({
        where: { name: "Work" },
      });

      expect(categories).toHaveLength(2);

      // Cleanup
      await prisma.category.deleteMany({ where: { userId: otherUser.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe("PUT /api/categories/:id", () => {
    beforeEach(async () => {
      const category = await prisma.category.create({
        data: {
          userId: testUserId,
          name: "Original",
          description: "Original description",
          color: "#FF0000",
        },
      });
      testCategoryId = category.id;
    });

    it("should update category", async () => {
      const updates = {
        name: "Updated",
        description: "Updated description",
        color: "#00FF00",
      };

      const response = await request(API_URL)
        .put(`/api/categories/${testCategoryId}`)
        .set("Cookie", authCookie)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.description).toBe(updates.description);
      expect(response.body.color).toBe(updates.color);

      // Verify in database
      const dbCategory = await prisma.category.findUnique({
        where: { id: testCategoryId },
      });
      expect(dbCategory?.name).toBe(updates.name);
    });

    it("should return 404 for non-existent category", async () => {
      await request(API_URL)
        .put("/api/categories/non-existent-id")
        .set("Cookie", authCookie)
        .send({ name: "Updated" })
        .expect(404);
    });

    it("should return 403 for category owned by different user", async () => {
      const otherUser = await prisma.user.create({
        data: { email: "other2@example.com", name: "Other User" },
      });

      const otherCategory = await prisma.category.create({
        data: {
          userId: otherUser.id,
          name: "Other Category",
          description: "Test",
          color: "#FF0000",
        },
      });

      await request(API_URL)
        .put(`/api/categories/${otherCategory.id}`)
        .set("Cookie", authCookie)
        .send({ name: "Hacked" })
        .expect(403);

      // Cleanup
      await prisma.category.delete({ where: { id: otherCategory.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe("DELETE /api/categories/:id", () => {
    beforeEach(async () => {
      const category = await prisma.category.create({
        data: {
          userId: testUserId,
          name: "To Delete",
          description: "Will be deleted",
          color: "#FF0000",
        },
      });
      testCategoryId = category.id;
    });

    it("should delete category", async () => {
      await request(API_URL)
        .delete(`/api/categories/${testCategoryId}`)
        .set("Cookie", authCookie)
        .expect(200);

      // Verify deletion
      const dbCategory = await prisma.category.findUnique({
        where: { id: testCategoryId },
      });
      expect(dbCategory).toBeNull();
    });

    it("should return 404 for non-existent category", async () => {
      await request(API_URL)
        .delete("/api/categories/non-existent-id")
        .set("Cookie", authCookie)
        .expect(404);
    });

    it("should return 403 for category owned by different user", async () => {
      const otherUser = await prisma.user.create({
        data: { email: "other3@example.com", name: "Other User" },
      });

      const otherCategory = await prisma.category.create({
        data: {
          userId: otherUser.id,
          name: "Other Category",
          description: "Test",
          color: "#FF0000",
        },
      });

      await request(API_URL)
        .delete(`/api/categories/${otherCategory.id}`)
        .set("Cookie", authCookie)
        .expect(403);

      // Cleanup
      await prisma.category.delete({ where: { id: otherCategory.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it("should handle category with associated emails", async () => {
      const gmailAccount = await prisma.gmailAccount.create({
        data: {
          userId: testUserId,
          email: "test2@gmail.com",
          accessToken: "encrypted",
          refreshToken: "encrypted",

        },
      });

      await prisma.email.create({
        data: {
          gmailAccountId: gmailAccount.id,
          categoryId: testCategoryId,
          gmailMessageId: "msg-with-category",
          subject: "Test",
          from: "sender@test.com",
          date: new Date(),
        },
      });

      // Deleting category should either:
      // 1. Set email categoryId to null, OR
      // 2. Return 400 if category has emails
      const response = await request(API_URL)
        .delete(`/api/categories/${testCategoryId}`)
        .set("Cookie", authCookie);

      expect([200, 400]).toContain(response.status);
    });
  });
});
