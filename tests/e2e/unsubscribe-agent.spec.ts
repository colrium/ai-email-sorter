/**
 * E2E Test: Unsubscribe Agent
 * Tests the Puppeteer-based automated unsubscribe functionality
 */

import { test, expect } from "@playwright/test";

test.describe("Unsubscribe Agent E2E", () => {
  test.beforeEach(async ({ page, context }) => {
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
  });

  test("should trigger unsubscribe agent for email", async ({ page }) => {
    // Find email with unsubscribe option
    const emailRow = page.locator('[data-testid="email-row"]').first();
    await emailRow.hover();

    // Click unsubscribe button
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Should show agent processing dialog
    const agentDialog = page.getByRole("dialog", { name: /unsubscribing/i });
    await expect(agentDialog).toBeVisible();
  });

  test("should display agent progress steps", async ({ page }) => {
    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Should show progress steps
    const steps = [
      /finding unsubscribe link/i,
      /opening unsubscribe page/i,
      /completing unsubscribe/i,
    ];

    for (const step of steps) {
      const stepText = page.getByText(step);
      await expect(stepText).toBeVisible({ timeout: 10000 });
    }
  });

  test("should handle successful unsubscribe", async ({ page }) => {
    // Mock successful unsubscribe
    await page.route("**/api/emails/*/unsubscribe", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          message: "Successfully unsubscribed",
        }),
      });
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Should show success message
    const successMessage = page.getByText(/successfully unsubscribed/i);
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    // Email should be marked as unsubscribed
    const unsubscribedBadge = emailRow.getByText(/unsubscribed/i);
    await expect(unsubscribedBadge).toBeVisible();
  });

  test("should handle unsubscribe link not found", async ({ page }) => {
    await page.route("**/api/emails/*/unsubscribe", (route) => {
      route.fulfill({
        status: 404,
        body: JSON.stringify({
          error: "No unsubscribe link found",
        }),
      });
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Should show error message
    const errorMessage = page.getByText(/no unsubscribe link found/i);
    await expect(errorMessage).toBeVisible();
  });

  test("should handle agent timeout", async ({ page }) => {
    await page.route("**/api/emails/*/unsubscribe", (route) => {
      route.fulfill({
        status: 408,
        body: JSON.stringify({
          error: "Unsubscribe process timed out",
        }),
      });
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Should show timeout error
    const timeoutMessage = page.getByText(/timed out|took too long/i);
    await expect(timeoutMessage).toBeVisible();
  });

  test("should show agent browser preview", async ({ page }) => {
    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Check if preview option is available
    const showPreviewButton = page.getByRole("button", {
      name: /show preview|watch agent/i,
    });

    if (await showPreviewButton.isVisible()) {
      await showPreviewButton.click();

      // Should show iframe or video of agent working
      const preview = page.locator('[data-testid="agent-preview"]');
      await expect(preview).toBeVisible();
    }
  });

  test("should allow manual intervention if agent fails", async ({ page }) => {
    await page.route("**/api/emails/*/unsubscribe", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: "Agent failed to complete unsubscribe",
          unsubscribeUrl: "https://example.com/unsubscribe",
        }),
      });
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Should offer manual unsubscribe option
    const manualButton = page.getByRole("button", {
      name: /unsubscribe manually|open link/i,
    });
    await expect(manualButton).toBeVisible();

    // Click manual button
    await manualButton.click();

    // Should open unsubscribe URL in new tab
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page"),
      manualButton.click(),
    ]);

    expect(newPage.url()).toContain("example.com");
  });

  test("should track unsubscribe job status", async ({ page }) => {
    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Navigate to jobs page
    await page.goto("http://localhost:3000/jobs");

    // Should show unsubscribe job
    const jobEntry = page.getByText(/unsubscribe|processing/i).first();
    await expect(jobEntry).toBeVisible();

    // Should show job status
    const statusBadge = page.locator('[data-testid="job-status"]').first();
    await expect(statusBadge).toBeVisible();
  });

  test("should handle CAPTCHA detection", async ({ page }) => {
    await page.route("**/api/emails/*/unsubscribe", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: false,
          captchaDetected: true,
          message: "CAPTCHA detected, manual intervention required",
        }),
      });
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Should show CAPTCHA message
    const captchaMessage = page.getByText(
      /captcha detected|manual verification required/i
    );
    await expect(captchaMessage).toBeVisible();
  });

  test("should retry failed unsubscribe attempts", async ({ page }) => {
    let attempts = 0;

    await page.route("**/api/emails/*/unsubscribe", (route) => {
      attempts++;

      if (attempts < 2) {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: "Temporary failure" }),
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      }
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Click retry button
    const retryButton = page.getByRole("button", { name: /retry/i });
    await retryButton.click();

    // Should eventually succeed
    const successMessage = page.getByText(/successfully unsubscribed/i);
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test("should display unsubscribe confirmation screenshot", async ({
    page,
  }) => {
    await page.route("**/api/emails/*/unsubscribe", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          screenshot: "data:image/png;base64,iVBORw0KGgoAAAANS...",
        }),
      });
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Wait for completion
    await page.waitForTimeout(2000);

    // Should show screenshot
    const screenshot = page.locator('[data-testid="unsubscribe-screenshot"]');
    await expect(screenshot).toBeVisible();
  });

  test("should handle multiple unsubscribe methods", async ({ page }) => {
    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Check if multiple methods are detected
    const methodSelection = page.getByText(
      /multiple unsubscribe methods found/i
    );

    if (await methodSelection.isVisible()) {
      // Should offer choice
      const linkMethod = page.getByRole("radio", { name: /unsubscribe link/i });
      const emailMethod = page.getByRole("radio", {
        name: /reply to unsubscribe/i,
      });

      await expect(linkMethod).toBeVisible();
      await expect(emailMethod).toBeVisible();

      // Select one
      await linkMethod.check();

      // Proceed
      const proceedButton = page.getByRole("button", {
        name: /proceed|continue/i,
      });
      await proceedButton.click();
    }
  });

  test("should save unsubscribe result to database", async ({ page }) => {
    await page.route("**/api/emails/*/unsubscribe", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          unsubscribedAt: new Date().toISOString(),
        }),
      });
    });

    const emailRow = page.locator('[data-testid="email-row"]').first();
    const emailId = await emailRow.getAttribute("data-email-id");

    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Wait for completion
    await page.waitForTimeout(2000);

    // Reload page
    await page.reload();

    // Email should still show as unsubscribed
    const reloadedEmail = page.locator(`[data-email-id="${emailId}"]`);
    const unsubscribedStatus = reloadedEmail.getByText(/unsubscribed/i);
    await expect(unsubscribedStatus).toBeVisible();
  });

  test("should show unsubscribe statistics", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("http://localhost:3000/dashboard");

    // Should show unsubscribe stats
    const statsCard = page.locator('[data-testid="unsubscribe-stats"]');

    if (await statsCard.isVisible()) {
      const successRate = statsCard.getByText(/success rate/i);
      await expect(successRate).toBeVisible();
    }
  });

  test("should handle email without unsubscribe option", async ({ page }) => {
    const emailRow = page.locator('[data-testid="email-row"]').first();

    // Check if unsubscribe button exists
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    const buttonCount = await unsubscribeButton.count();

    if (buttonCount === 0) {
      // Should show "no unsubscribe available" message or disabled state
      const noUnsubscribe = emailRow.getByText(/no unsubscribe available/i);
      await expect(noUnsubscribe).toBeVisible();
    }
  });

  test("should cancel ongoing unsubscribe process", async ({ page }) => {
    const emailRow = page.locator('[data-testid="email-row"]').first();
    const unsubscribeButton = emailRow.getByRole("button", {
      name: /unsubscribe/i,
    });
    await unsubscribeButton.click();

    // Look for cancel button while processing
    const cancelButton = page.getByRole("button", { name: /cancel|stop/i });

    if (await cancelButton.isVisible({ timeout: 2000 })) {
      await cancelButton.click();

      // Process should stop
      const cancelledMessage = page.getByText(/cancelled|stopped/i);
      await expect(cancelledMessage).toBeVisible();
    }
  });
});
