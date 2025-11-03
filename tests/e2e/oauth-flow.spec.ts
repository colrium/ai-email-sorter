/**
 * E2E Test: OAuth Flow
 * Tests the complete Google OAuth authentication flow
 */

import { test, expect } from "@playwright/test";

test.describe("OAuth Flow E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Start at the login page
    await page.goto("http://localhost:3000/login");
  });

  test("should display login page with Google sign-in button", async ({
    page,
  }) => {
    await expect(page).toHaveTitle(/AI Email Sorter/);

    const signInButton = page.getByRole("button", {
      name: /sign in with google/i,
    });
    await expect(signInButton).toBeVisible();
  });

  test("should redirect to Google OAuth on sign-in click", async ({ page }) => {
    const signInButton = page.getByRole("button", {
      name: /sign in with google/i,
    });

    // Click sign in
    await signInButton.click();

    // Should redirect to Google OAuth (or mock OAuth in test environment)
    await page.waitForURL(/accounts\.google\.com|localhost:3000\/api\/auth/);

    // In test environment, might redirect back immediately
    // In production, would show Google consent screen
  });

  test("should handle OAuth callback with valid code", async ({
    page,
    context,
  }) => {
    // Mock successful OAuth callback
    await page.goto(
      "http://localhost:3000/api/auth/callback/google?code=test-auth-code&state=test-state"
    );

    // Should redirect to dashboard after successful auth
    await page.waitForURL(/\/dashboard/);

    // Verify user is authenticated
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes("next-auth"));
    expect(sessionCookie).toBeDefined();
  });

  test("should handle OAuth error", async ({ page }) => {
    // Navigate with error parameter
    await page.goto(
      "http://localhost:3000/api/auth/callback/google?error=access_denied"
    );

    // Should redirect back to login
    await page.waitForURL(/\/login/);

    // Should show error message
    const errorMessage = page.getByText(/authentication failed|access denied/i);
    await expect(errorMessage).toBeVisible();
  });

  test("should maintain session across page reloads", async ({
    page,
    context,
  }) => {
    // Set up authenticated session
    await context.addCookies([
      {
        name: "next-auth.session-token",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Navigate to dashboard
    await page.goto("http://localhost:3000/dashboard");

    // Should remain authenticated after reload
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("should sign out successfully", async ({ page, context }) => {
    // Set up authenticated session
    await context.addCookies([
      {
        name: "next-auth.session-token",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("http://localhost:3000/dashboard");

    // Click sign out
    const signOutButton = page.getByRole("button", { name: /sign out/i });
    await signOutButton.click();

    // Should redirect to login
    await page.waitForURL(/\/login/);

    // Session cookie should be cleared
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes("next-auth"));
    expect(sessionCookie).toBeUndefined();
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    // Try to access protected route without auth
    await page.goto("http://localhost:3000/dashboard");

    // Should redirect to login
    await page.waitForURL(/\/login/);
  });

  test("should handle multiple Gmail account connections", async ({
    page,
    context,
  }) => {
    // Set up authenticated session
    await context.addCookies([
      {
        name: "next-auth.session-token",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("http://localhost:3000/settings");

    // Click add account button
    const addAccountButton = page.getByRole("button", {
      name: /add another account/i,
    });
    await addAccountButton.click();

    // Should redirect to OAuth flow
    await page.waitForURL(/accounts\.google\.com|localhost:3000\/api\/auth/);
  });

  test("should display OAuth scopes to user", async ({ page }) => {
    await page.goto("http://localhost:3000/login");

    // Look for scope information
    const scopeInfo = page.getByText(/gmail access|read and manage email/i);
    await expect(scopeInfo).toBeVisible();
  });

  test("should handle expired session gracefully", async ({
    page,
    context,
  }) => {
    // Set up expired session
    await context.addCookies([
      {
        name: "next-auth.session-token",
        value: "expired-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("http://localhost:3000/dashboard");

    // Should redirect to login when session is expired
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });
});
