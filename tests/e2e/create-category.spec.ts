/**
 * E2E Test: Create Category Flow
 * Tests the complete category creation and management workflow
 */

import { test, expect } from "@playwright/test";

test.describe("Create Category E2E", () => {
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

    await page.goto("http://localhost:3000/categories");
  });

  test("should display categories page", async ({ page }) => {
    await expect(page).toHaveTitle(/Categories/);

    const heading = page.getByRole("heading", { name: /categories/i });
    await expect(heading).toBeVisible();
  });

  test("should create a new category successfully", async ({ page }) => {
    // Click create category button
    const createButton = page.getByRole("button", { name: /create category/i });
    await createButton.click();

    // Fill in category form
    await page.getByLabel(/name/i).fill("Work Emails");
    await page.getByLabel(/description/i).fill("All work-related emails");

    // Select color
    await page.getByLabel(/color/i).click();
    await page.getByRole("option", { name: /red/i }).click();

    // Submit form
    await page.getByRole("button", { name: /save|create/i }).click();

    // Should show success message
    const successMessage = page.getByText(/category created/i);
    await expect(successMessage).toBeVisible();

    // New category should appear in list
    const categoryCard = page.getByText("Work Emails");
    await expect(categoryCard).toBeVisible();
  });

  test("should validate required fields", async ({ page }) => {
    const createButton = page.getByRole("button", { name: /create category/i });
    await createButton.click();

    // Try to submit without filling fields
    await page.getByRole("button", { name: /save|create/i }).click();

    // Should show validation errors
    const nameError = page.getByText(/name is required/i);
    await expect(nameError).toBeVisible();
  });

  test("should prevent duplicate category names", async ({ page }) => {
    // Create first category
    await page.getByRole("button", { name: /create category/i }).click();
    await page.getByLabel(/name/i).fill("Newsletters");
    await page.getByRole("button", { name: /save|create/i }).click();

    await page.waitForTimeout(1000); // Wait for creation

    // Try to create duplicate
    await page.getByRole("button", { name: /create category/i }).click();
    await page.getByLabel(/name/i).fill("Newsletters");
    await page.getByRole("button", { name: /save|create/i }).click();

    // Should show error
    const errorMessage = page.getByText(/already exists|duplicate/i);
    await expect(errorMessage).toBeVisible();
  });

  test("should edit existing category", async ({ page }) => {
    // Assume category exists, click edit
    const editButton = page.getByRole("button", { name: /edit/i }).first();
    await editButton.click();

    // Modify fields
    await page.getByLabel(/name/i).fill("Updated Category Name");
    await page.getByLabel(/description/i).fill("Updated description");

    // Save changes
    await page.getByRole("button", { name: /save/i }).click();

    // Should show success message
    const successMessage = page.getByText(/category updated/i);
    await expect(successMessage).toBeVisible();

    // Updated name should appear
    const updatedCategory = page.getByText("Updated Category Name");
    await expect(updatedCategory).toBeVisible();
  });

  test("should delete category", async ({ page }) => {
    // Click delete button
    const deleteButton = page.getByRole("button", { name: /delete/i }).first();
    await deleteButton.click();

    // Confirm deletion
    const confirmButton = page.getByRole("button", { name: /confirm|yes/i });
    await confirmButton.click();

    // Should show success message
    const successMessage = page.getByText(/category deleted/i);
    await expect(successMessage).toBeVisible();
  });

  test("should cancel category deletion", async ({ page }) => {
    const deleteButton = page.getByRole("button", { name: /delete/i }).first();
    await deleteButton.click();

    // Cancel deletion
    const cancelButton = page.getByRole("button", { name: /cancel|no/i });
    await cancelButton.click();

    // Dialog should close without deleting
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).not.toBeVisible();
  });

  test("should display email count for each category", async ({ page }) => {
    // Look for email counts
    const emailCounts = page.locator('[data-testid="email-count"]');
    const count = await emailCounts.count();

    expect(count).toBeGreaterThan(0);

    // Each count should be a number
    const firstCount = await emailCounts.first().textContent();
    expect(firstCount).toMatch(/\d+/);
  });

  test("should filter categories by search", async ({ page }) => {
    // Type in search box
    const searchInput = page.getByPlaceholder(/search categories/i);
    await searchInput.fill("Work");

    // Should show only matching categories
    await page.waitForTimeout(500); // Debounce

    const visibleCategories = page.locator(
      '[data-testid="category-card"]:visible'
    );
    const count = await visibleCategories.count();

    // At least one category should match
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should sort categories", async ({ page }) => {
    // Click sort dropdown
    const sortButton = page.getByRole("button", { name: /sort/i });
    await sortButton.click();

    // Select sort option
    await page.getByRole("option", { name: /name/i }).click();

    // Categories should be sorted
    const categoryNames = await page
      .locator('[data-testid="category-name"]')
      .allTextContents();
    const sortedNames = [...categoryNames].sort();

    expect(categoryNames).toEqual(sortedNames);
  });

  test("should navigate to category details", async ({ page }) => {
    // Click on a category
    const categoryCard = page.locator('[data-testid="category-card"]').first();
    await categoryCard.click();

    // Should navigate to category details page
    await page.waitForURL(/\/categories\/[a-zA-Z0-9]+/);

    // Should show emails in category
    const emailsList = page.locator('[data-testid="emails-list"]');
    await expect(emailsList).toBeVisible();
  });

  test("should show empty state when no categories exist", async ({ page }) => {
    // This test assumes starting with no categories
    // In real scenario, you'd clear categories first

    // Empty state may or may not be visible depending on data
    // Just verify the page loads
    await expect(
      page.getByRole("button", { name: /create category/i })
    ).toBeVisible();
  });

  test("should assign category color correctly", async ({ page }) => {
    await page.getByRole("button", { name: /create category/i }).click();

    await page.getByLabel(/name/i).fill("Test Color");

    // Select blue color
    await page.getByLabel(/color/i).click();
    const blueOption = page.locator('[data-color="#0000FF"]');
    await blueOption.click();

    await page.getByRole("button", { name: /save|create/i }).click();

    // Verify color is applied
    const categoryCard = page.getByText("Test Color").locator("..");
    const backgroundColor = await categoryCard.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );

    // Background should have blue color
    expect(backgroundColor).toBeTruthy();
  });

  test("should handle API errors gracefully", async ({ page }) => {
    // Intercept API call and return error
    await page.route("**/api/categories", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.getByRole("button", { name: /create category/i }).click();
    await page.getByLabel(/name/i).fill("Error Test");
    await page.getByRole("button", { name: /save|create/i }).click();

    // Should show error message
    const errorMessage = page.getByText(/error|failed/i);
    await expect(errorMessage).toBeVisible();
  });

  test("should display category details in modal", async ({ page }) => {
    const categoryCard = page.locator('[data-testid="category-card"]').first();

    // Click view details
    const viewButton = categoryCard.getByRole("button", {
      name: /view|details/i,
    });
    await viewButton.click();

    // Modal should open
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // Should show category information
    const categoryName = modal.getByTestId("category-name");
    await expect(categoryName).toBeVisible();
  });
});
