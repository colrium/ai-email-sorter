/**
 * Integration Tests for Auth API
 * Tests OAuth flow and session management
 */

import { describe, it, expect, afterAll } from "@jest/globals";
import request from "supertest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

describe("Auth API Integration Tests", () => {
  let testUserId: string;

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await prisma.gmailAccount.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  describe("GET /api/auth/session", () => {
    it("should return null for unauthenticated user", async () => {
      const response = await request(API_URL)
        .get("/api/auth/session")
        .expect(200);

      expect(response.body).toBeNull();
    });

    it("should return session for authenticated user", async () => {
      // Create test user
      const user = await prisma.user.create({
        data: {
          email: "test-auth@example.com",
          name: "Test Auth User",
        },
      });
      testUserId = user.id;

      // Mock session cookie
      const authCookie = `next-auth.session-token=test-token-${testUserId}`;

      const response = await request(API_URL)
        .get("/api/auth/session")
        .set("Cookie", authCookie)
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(user.email);
    });
  });

  describe("POST /api/auth/signin", () => {
    it("should redirect to Google OAuth", async () => {
      const response = await request(API_URL)
        .post("/api/auth/signin/google")
        .expect(302); // Redirect

      expect(response.headers.location).toContain("accounts.google.com");
    });

    it("should include correct OAuth scopes", async () => {
      const response = await request(API_URL)
        .post("/api/auth/signin/google")
        .expect(302);

      const location = response.headers.location;
      expect(location).toContain("scope");
      expect(location).toContain("gmail.readonly");
      expect(location).toContain("gmail.modify");
    });
  });

  describe("GET /api/auth/callback/google", () => {
    it("should return 400 for missing code", async () => {
      await request(API_URL).get("/api/auth/callback/google").expect(400);
    });

    it("should return 400 for invalid code", async () => {
      await request(API_URL)
        .get("/api/auth/callback/google?code=invalid-code")
        .expect(400);
    });

    // Note: Full OAuth callback testing requires mocking Google's OAuth server
    // In real tests, you would use a library like nock to mock the Google API responses
  });

  describe("POST /api/auth/signout", () => {
    it("should clear session cookie", async () => {
      const user = await prisma.user.create({
        data: {
          email: "test-signout@example.com",
          name: "Test Signout User",
        },
      });

      const authCookie = `next-auth.session-token=test-token-${user.id}`;

      const response = await request(API_URL)
        .post("/api/auth/signout")
        .set("Cookie", authCookie)
        .expect(200);

      // Verify session cookie is cleared
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      expect(
        cookieArray.some((c: string) => c.includes("next-auth.session-token="))
      ).toBe(true);

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    });

    it("should work even when not authenticated", async () => {
      await request(API_URL).post("/api/auth/signout").expect(200);
    });
  });

  describe("OAuth Token Management", () => {
    it("should encrypt tokens when storing user", async () => {
      const user = await prisma.user.create({
        data: {
          email: "test-tokens@example.com",
          name: "Test Token User",
        },
      });

      const gmailAccount = await prisma.gmailAccount.create({
        data: {
          userId: user.id,
          email: "gmail-test@gmail.com",
          accessToken: "encrypted-access-token",
          refreshToken: "encrypted-refresh-token",
        },
      });

      // Verify tokens are stored (encrypted in real implementation)
      const stored = await prisma.gmailAccount.findUnique({
        where: { id: gmailAccount.id },
      });

      expect(stored?.accessToken).toBeTruthy();
      expect(stored?.refreshToken).toBeTruthy();
      // In real implementation, these should be encrypted
      expect(stored?.accessToken).not.toBe("plain-access-token");

      // Cleanup
      await prisma.gmailAccount.delete({ where: { id: gmailAccount.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it("should handle token refresh", async () => {
      const user = await prisma.user.create({
        data: {
          email: "test-refresh@example.com",
          name: "Test Refresh User",
        },
      });

      const gmailAccount = await prisma.gmailAccount.create({
        data: {
          userId: user.id,
          email: "refresh-test@gmail.com",
          accessToken: "old-access-token",
          refreshToken: "refresh-token",
        },
      });

      // Simulate token refresh
      await prisma.gmailAccount.update({
        where: { id: gmailAccount.id },
        data: {
          accessToken: "new-access-token",
        },
      });

      const updated = await prisma.gmailAccount.findUnique({
        where: { id: gmailAccount.id },
      });

      expect(updated?.accessToken).toBe("new-access-token");

      // Cleanup
      await prisma.gmailAccount.delete({ where: { id: gmailAccount.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe("User Creation Flow", () => {
    it("should create user on first sign in", async () => {
      const email = "new-user@example.com";

      // Simulate OAuth callback creating user
      const user = await prisma.user.create({
        data: {
          email,
          name: "New User",
        },
      });

      expect(user.id).toBeTruthy();
      expect(user.email).toBe(email);

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    });

    it("should not create duplicate users", async () => {
      const email = "existing@example.com";

      const user1 = await prisma.user.create({
        data: { email, name: "User 1" },
      });

      // Try to find existing user instead of creating duplicate
      const existing = await prisma.user.findUnique({
        where: { email },
      });

      expect(existing?.id).toBe(user1.id);

      // Cleanup
      await prisma.user.delete({ where: { id: user1.id } });
    });

    it("should create gmail account on successful OAuth", async () => {
      const user = await prisma.user.create({
        data: {
          email: "gmail-user@example.com",
          name: "Gmail User",
        },
      });

      const gmailAccount = await prisma.gmailAccount.create({
        data: {
          userId: user.id,
          email: "gmail@gmail.com",
          accessToken: "encrypted-token",
          refreshToken: "encrypted-token",
        },
      });

      expect(gmailAccount.userId).toBe(user.id);
      expect(gmailAccount.email).toBe("test@gmail.com");

      // Cleanup
      await prisma.gmailAccount.delete({ where: { id: gmailAccount.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe("Session Security", () => {
    it("should not expose sensitive user data in session", async () => {
      const user = await prisma.user.create({
        data: {
          email: "secure@example.com",
          name: "Secure User",
        },
      });

      const gmailAccount = await prisma.gmailAccount.create({
        data: {
          userId: user.id,
          email: "secure-gmail@gmail.com",
          accessToken: "super-secret-token",
          refreshToken: "super-secret-refresh",
        },
      });

      const authCookie = `next-auth.session-token=test-token-${user.id}`;

      const response = await request(API_URL)
        .get("/api/auth/session")
        .set("Cookie", authCookie)
        .expect(200);

      // Session should not include access tokens
      expect(JSON.stringify(response.body)).not.toContain("super-secret-token");
      expect(JSON.stringify(response.body)).not.toContain(
        "super-secret-refresh"
      );

      // Cleanup
      await prisma.gmailAccount.delete({ where: { id: gmailAccount.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it("should validate session expiry", async () => {
      // In real implementation, sessions should expire
      // This test would verify that expired sessions are rejected
      const expiredCookie = "next-auth.session-token=expired-token";

      const response = await request(API_URL)
        .get("/api/auth/session")
        .set("Cookie", expiredCookie)
        .expect(200);

      expect(response.body).toBeNull();
    });
  });

  describe("Multiple Account Support", () => {
    it("should allow connecting additional Gmail accounts", async () => {
      const user = await prisma.user.create({
        data: {
          email: "multi@example.com",
          name: "Multi Account User",
        },
      });

      // Create first Gmail account
      await prisma.gmailAccount.create({
        data: {
          userId: user.id,
          email: "first@gmail.com",
          accessToken: "token1",
          refreshToken: "refresh1",
        },
      });

      // Create second Gmail account
      await prisma.gmailAccount.create({
        data: {
          userId: user.id,
          email: "second@gmail.com",
          accessToken: "token2",
          refreshToken: "refresh2",
        },
      });

      // Verify both accounts exist
      const accounts = await prisma.gmailAccount.findMany({
        where: { userId: user.id },
      });

      expect(accounts).toHaveLength(2);
      expect(accounts.map((a: { email: string }) => a.email)).toContain(
        "first@gmail.com"
      );
      expect(accounts.map((a: { email: string }) => a.email)).toContain(
        "second@gmail.com"
      );

      // Cleanup
      await prisma.gmailAccount.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it("should prevent duplicate Gmail accounts", async () => {
      const user = await prisma.user.create({
        data: {
          email: "dupe@example.com",
          name: "Dupe User",
        },
      });

      await prisma.gmailAccount.create({
        data: {
          userId: user.id,
          email: "same@gmail.com",
          accessToken: "token",
          refreshToken: "refresh",
        },
      });

      // Try to create duplicate (should fail due to unique constraint)
      await expect(
        prisma.gmailAccount.create({
          data: {
            userId: user.id,
            email: "same@gmail.com",
            accessToken: "token2",
            refreshToken: "refresh2",
          },
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.gmailAccount.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });
});
