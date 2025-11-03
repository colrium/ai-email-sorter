/**
 * Unsubscribe Service
 * Orchestrates the automated unsubscribe process
 */

import { Page } from "puppeteer";
import {
  createPage,
  navigateToUrl,
  takeScreenshot,
  getPageHtml,
  getPageText,
  clickElement,
  fillInput,
  selectOption,
  closeBrowser,
} from "@/lib/browser/puppeteer-client";
import {
  analyzeUnsubscribePage,
  verifyUnsubscribeSuccess,
  UnsubscribeAction,
} from "@/lib/ai/unsubscribe-agent";
import { getBestUnsubscribeLink } from "@/lib/utils/unsubscribe-link-finder";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

export interface UnsubscribeResult {
  success: boolean;
  message: string;
  steps: string[];
  screenshots?: string[];
  error?: string;
}

/**
 * Attempt to unsubscribe from an email
 */
export async function unsubscribeFromEmail(
  emailId: string,
  userEmail?: string
): Promise<UnsubscribeResult> {
  let page: Page | null = null;
  const steps: string[] = [];
  const screenshots: string[] = [];

  try {
    // Get email from database
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { gmailAccount: true },
    });

    if (!email) {
      throw new Error("Email not found");
    }

    steps.push("Retrieved email from database");

    // Extract unsubscribe link
    const unsubscribeLink = getBestUnsubscribeLink(
      email.bodyHtml || "",
      email.bodyText || "",
      { "list-unsubscribe": email.listUnsubscribeHeader || "" }
    );

    if (!unsubscribeLink) {
      return {
        success: false,
        message: "No unsubscribe link found in email",
        steps,
      };
    }

    steps.push(`Found unsubscribe link: ${unsubscribeLink}`);
    logger.info("Starting unsubscribe process", { emailId, unsubscribeLink });

    // Handle mailto: links differently
    if (unsubscribeLink.startsWith("mailto:")) {
      return await handleMailtoUnsubscribe(unsubscribeLink, steps);
    }

    // Create browser page
    page = await createPage();
    steps.push("Launched browser");

    // Navigate to unsubscribe page
    const navigated = await navigateToUrl(page, unsubscribeLink);
    if (!navigated) {
      throw new Error("Failed to navigate to unsubscribe page");
    }

    steps.push("Navigated to unsubscribe page");

    // Take initial screenshot
    const initialScreenshot = await takeScreenshot(page);
    screenshots.push(initialScreenshot);

    // Get page content
    const html = await getPageHtml(page);
    const text = await getPageText(page);

    // Analyze page with AI
    steps.push("Analyzing page with AI");
    const analysis = await analyzeUnsubscribePage(html, text, unsubscribeLink);

    if (!analysis.canUnsubscribe) {
      return {
        success: false,
        message: `Cannot unsubscribe: ${analysis.reasoning}`,
        steps,
        screenshots,
      };
    }

    if (analysis.confidence < 50) {
      return {
        success: false,
        message: `Low confidence (${analysis.confidence}%): ${analysis.reasoning}`,
        steps,
        screenshots,
      };
    }

    steps.push(
      `AI analysis complete: ${analysis.confidence}% confidence, ${analysis.actions.length} actions`
    );

    // Execute actions
    for (const action of analysis.actions) {
      const executed = await executeAction(
        page,
        action,
        userEmail || email.gmailAccount.email
      );
      if (executed) {
        steps.push(`✓ ${action.description}`);
      } else {
        steps.push(`✗ Failed: ${action.description}`);
      }

      // Wait between actions
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Take final screenshot
    const finalScreenshot = await takeScreenshot(page);
    screenshots.push(finalScreenshot);

    // Verify success
    const finalText = await getPageText(page);
    const isSuccess = await verifyUnsubscribeSuccess(
      finalText,
      analysis.successIndicators
    );

    // Log to database
    await logUnsubscribeAttempt(emailId, unsubscribeLink, isSuccess, steps);

    if (isSuccess) {
      // Update email record
      await prisma.email.update({
        where: { id: emailId },
        data: { unsubscribedAt: new Date() },
      });
    }

    return {
      success: isSuccess,
      message: isSuccess
        ? "Successfully unsubscribed"
        : "Unsubscribe completed but success could not be verified",
      steps,
      screenshots,
    };
  } catch (error) {
    logger.error("Unsubscribe failed", { emailId, error });

    await logUnsubscribeAttempt(
      emailId,
      "",
      false,
      steps,
      error instanceof Error ? error.message : String(error)
    );

    return {
      success: false,
      message: "Unsubscribe failed",
      steps,
      screenshots,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Execute a single action
 */
async function executeAction(
  page: Page,
  action: UnsubscribeAction,
  userEmail: string
): Promise<boolean> {
  try {
    switch (action.type) {
      case "click":
        if (action.selector) {
          return await clickElement(page, action.selector);
        }
        return false;

      case "fill":
        if (action.selector && action.value) {
          // Replace {{EMAIL}} placeholder with actual email
          const value = action.value.replace("{{EMAIL}}", userEmail);
          return await fillInput(page, action.selector, value);
        }
        return false;

      case "select":
        if (action.selector && action.value) {
          return await selectOption(page, action.selector, action.value);
        }
        return false;

      case "submit":
        if (action.selector) {
          // Try clicking submit button or submitting form
          const clicked = await clickElement(page, action.selector);
          if (clicked) {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for submission
          }
          return clicked;
        }
        return false;

      case "wait":
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return true;

      default:
        logger.warn("Unknown action type", { action });
        return false;
    }
  } catch (error) {
    logger.error("Failed to execute action", { action, error });
    return false;
  }
}

/**
 * Handle mailto: unsubscribe links
 */
async function handleMailtoUnsubscribe(
  mailto: string,
  steps: string[]
): Promise<UnsubscribeResult> {
  steps.push(`Found mailto link: ${mailto}`);
  steps.push("Mailto unsubscribe requires manual action - email client needed");

  return {
    success: false,
    message:
      "This email uses mailto: unsubscribe. Please manually send an email to: " +
      mailto.replace("mailto:", ""),
    steps,
  };
}

/**
 * Log unsubscribe attempt to database
 */
async function logUnsubscribeAttempt(
  emailId: string,
  unsubscribeUrl: string,
  success: boolean,
  steps: string[],
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.unsubscribeLog.create({
      data: {
        emailId,
        unsubscribeUrl,
        status: success ? "success" : "failed",
        actions: steps.join("\n"),
        errorMessage,
      },
    });
  } catch (error) {
    logger.error("Failed to log unsubscribe attempt", { emailId, error });
  }
}

/**
 * Bulk unsubscribe from multiple emails
 */
export async function bulkUnsubscribe(
  emailIds: string[],
  userEmail?: string
): Promise<Map<string, UnsubscribeResult>> {
  const results = new Map<string, UnsubscribeResult>();

  logger.info("Starting bulk unsubscribe", { count: emailIds.length });

  for (const emailId of emailIds) {
    try {
      const result = await unsubscribeFromEmail(emailId, userEmail);
      results.set(emailId, result);

      // Wait between attempts to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error("Bulk unsubscribe item failed", { emailId, error });
      results.set(emailId, {
        success: false,
        message: "Failed to process",
        steps: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Clean up browser
  await closeBrowser();

  logger.info("Bulk unsubscribe complete", {
    total: emailIds.length,
    successful: Array.from(results.values()).filter((r) => r.success).length,
  });

  return results;
}

/**
 * Get unsubscribe logs for an email
 */
export async function getUnsubscribeLogs(emailId: string) {
  return await prisma.unsubscribeLog.findMany({
    where: { emailId },
    orderBy: { createdAt: "desc" },
  });
}
