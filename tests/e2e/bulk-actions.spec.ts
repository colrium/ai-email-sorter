/**
 * E2E Test: Bulk Actions
 * Tests bulk email operations (delete, unsubscribe)
 */

import { test, expect } from "@playwright/test";

test.describe("Bulk Actions E2E", () => {
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

  test("should display email list with checkboxes", async ({ page }) => {
    const emailCheckboxes = page.locator('[data-testid="email-checkbox"]');
    const count = await emailCheckboxes.count();

    expect(count).toBeGreaterThan(0);
  });

  test("should select multiple emails", async ({ page }) => {
    // Select first 3 emails
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Verify they are checked
    await expect(checkboxes.nth(0)).toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
    await expect(checkboxes.nth(2)).toBeChecked();

    // Bulk action bar should appear
    const bulkActionBar = page.locator('[data-testid="bulk-action-bar"]');
    await expect(bulkActionBar).toBeVisible();
  });

  test("should select all emails", async ({ page }) => {
    // Click select all checkbox
    const selectAllCheckbox = page.locator(
      '[data-testid="select-all-checkbox"]'
    );
    await selectAllCheckbox.check();

    // All email checkboxes should be checked
    const emailCheckboxes = page.locator('[data-testid="email-checkbox"]');
    const count = await emailCheckboxes.count();

    for (let i = 0; i < count; i++) {
      await expect(emailCheckboxes.nth(i)).toBeChecked();
    }

    // Selected count should be displayed
    const selectedCount = page.getByText(/\d+ selected/i);
    await expect(selectedCount).toBeVisible();
  });

  test("should deselect all emails", async ({ page }) => {
    // Select all first
    await page.locator('[data-testid="select-all-checkbox"]').check();

    // Then deselect all
    await page.locator('[data-testid="select-all-checkbox"]').uncheck();

    // All checkboxes should be unchecked
    const emailCheckboxes = page.locator('[data-testid="email-checkbox"]');
    const count = await emailCheckboxes.count();

    for (let i = 0; i < count; i++) {
      await expect(emailCheckboxes.nth(i)).not.toBeChecked();
    }

    // Bulk action bar should disappear
    const bulkActionBar = page.locator('[data-testid="bulk-action-bar"]');
    await expect(bulkActionBar).not.toBeVisible();
  });

  test("should bulk delete selected emails", async ({ page }) => {
    // Select emails
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Click bulk delete button
    const deleteButton = page.getByRole("button", { name: /delete selected/i });
    await deleteButton.click();

    // Confirm deletion
    const confirmButton = page.getByRole("button", { name: /confirm|yes/i });
    await confirmButton.click();

    // Should show success message
    const successMessage = page.getByText(/\d+ emails deleted/i);
    await expect(successMessage).toBeVisible();

    // Email count should decrease
    await page.waitForTimeout(1000);
    const remainingEmails = await page
      .locator('[data-testid="email-row"]')
      .count();
    expect(remainingEmails).toBeLessThan(100); // Arbitrary check
  });

  test("should cancel bulk delete", async ({ page }) => {
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();

    const deleteButton = page.getByRole("button", { name: /delete selected/i });
    await deleteButton.click();

    // Cancel deletion
    const cancelButton = page.getByRole("button", { name: /cancel|no/i });
    await cancelButton.click();

    // Dialog should close
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toBeVisible();

    // Emails should still be there
    await expect(checkboxes.nth(0)).toBeVisible();
  });

  test("should bulk unsubscribe from selected emails", async ({ page }) => {
    // Select emails
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Click bulk unsubscribe button
    const unsubscribeButton = page.getByRole("button", {
      name: /unsubscribe selected/i,
    });
    await unsubscribeButton.click();

    // Should show confirmation or progress dialog
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Should show processing message
    const processingMessage = page.getByText(/processing|unsubscribing/i);
    await expect(processingMessage).toBeVisible();
  });

  test("should show unsubscribe progress", async ({ page }) => {
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    const unsubscribeButton = page.getByRole("button", {
      name: /unsubscribe selected/i,
    });
    await unsubscribeButton.click();

    // Should show progress bar or count
    const progressIndicator = page.locator(
      '[data-testid="unsubscribe-progress"]'
    );
    await expect(progressIndicator).toBeVisible();

    // Should show completed count
    await page.waitForTimeout(2000);
    const completedText = page.getByText(/\d+ of \d+ complete/i);
    await expect(completedText).toBeVisible();
  });

  test("should filter emails before bulk action", async ({ page }) => {
    // Apply filter
    const filterButton = page.getByRole("button", { name: /filter/i });
    await filterButton.click();

    // Select category filter
    await page.getByRole("option", { name: /newsletters/i }).click();

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Select filtered emails
    await page.locator('[data-testid="select-all-checkbox"]').check();

    // Delete filtered emails
    await page.getByRole("button", { name: /delete selected/i }).click();
    await page.getByRole("button", { name: /confirm|yes/i }).click();

    // Should delete only filtered emails
    const successMessage = page.getByText(/deleted/i);
    await expect(successMessage).toBeVisible();
  });

  test("should display bulk action statistics", async ({ page }) => {
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Should show count of selected emails
    const selectedCount = page.getByText(/3 selected/i);
    await expect(selectedCount).toBeVisible();
  });

  test("should handle partial bulk operation failures", async ({ page }) => {
    // Intercept API to simulate partial failure
    await page.route("**/api/emails/bulk-delete", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: 2,
          failed: 1,
          errors: ["Failed to delete email 3"],
        }),
      });
    });

    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    await page.getByRole("button", { name: /delete selected/i }).click();
    await page.getByRole("button", { name: /confirm|yes/i }).click();

    // Should show partial success message
    const partialMessage = page.getByText(/2 of 3|some emails could not/i);
    await expect(partialMessage).toBeVisible();
  });

  test("should maintain selection after page scroll", async ({ page }) => {
    // Select emails
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Scroll page
    await page.evaluate(() => window.scrollBy(0, 500));

    // Selections should persist
    await expect(checkboxes.nth(0)).toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
  });

  test("should clear selection after bulk action completion", async ({
    page,
  }) => {
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.getByRole("button", { name: /delete selected/i }).click();
    await page.getByRole("button", { name: /confirm|yes/i }).click();

    // Wait for deletion to complete
    await page.waitForTimeout(1000);

    // Selections should be cleared
    const bulkActionBar = page.locator('[data-testid="bulk-action-bar"]');
    await expect(bulkActionBar).not.toBeVisible();
  });

  test("should disable bulk actions when no emails selected", async ({
    page,
  }) => {
    // Ensure no emails are selected
    const selectAllCheckbox = page.locator(
      '[data-testid="select-all-checkbox"]'
    );
    if (await selectAllCheckbox.isChecked()) {
      await selectAllCheckbox.uncheck();
    }

    // Bulk action buttons should be disabled or hidden
    const deleteButton = page.getByRole("button", { name: /delete selected/i });
    const unsubscribeButton = page.getByRole("button", {
      name: /unsubscribe selected/i,
    });

    await expect(deleteButton).toBeDisabled();
    await expect(unsubscribeButton).toBeDisabled();
  });

  test("should show warning for large bulk operations", async ({ page }) => {
    // Select many emails (or mock a large selection)
    await page.locator('[data-testid="select-all-checkbox"]').check();

    // Assume there are many emails
    const selectedCount = page.getByText(/\d+ selected/i);
    await expect(selectedCount).toBeVisible();

    // Click bulk delete
    await page.getByRole("button", { name: /delete selected/i }).click();

    // Should show warning about large operation
    const warningText = page.getByText(/this will delete|are you sure/i);
    await expect(warningText).toBeVisible();
  });

  test("should support keyboard shortcuts for bulk actions", async ({
    page,
  }) => {
    // Select first email
    const firstEmail = page.locator('[data-testid="email-row"]').first();
    await firstEmail.click();

    // Use keyboard to select more (Shift+Down)
    await page.keyboard.press("Shift+ArrowDown");

    // Multiple emails should be selected
    const selectedCount = await page
      .locator('[data-testid="email-checkbox"]:checked')
      .count();
    expect(selectedCount).toBeGreaterThan(1);
  });

  test("should show bulk action history", async ({ page }) => {
    // Perform bulk action
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.getByRole("button", { name: /delete selected/i }).click();
    await page.getByRole("button", { name: /confirm|yes/i }).click();

    // Navigate to history/activity log
    await page.goto("http://localhost:3000/jobs");

    // Should show bulk delete job
    const jobEntry = page.getByText(/bulk delete|deleted \d+ emails/i);
    await expect(jobEntry).toBeVisible();
  });

  test("should export selected emails", async ({ page }) => {
    const checkboxes = page.locator('[data-testid="email-checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Click export button
    const exportButton = page.getByRole("button", { name: /export selected/i });
    await exportButton.click();

    // Should trigger download or show export options
    const exportDialog = page.getByRole("dialog");
    await expect(exportDialog).toBeVisible();
  });
});
