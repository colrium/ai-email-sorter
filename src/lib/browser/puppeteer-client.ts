/**
 * Puppeteer Browser Client
 * Provides headless browser automation for unsubscribe operations
 */

import puppeteer, { Browser, Page } from "puppeteer";
import { logger } from "@/lib/utils/logger";

let browser: Browser | null = null;

/**
 * Get or create browser instance
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    logger.info("Launching Puppeteer browser");

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    logger.info("Puppeteer browser launched successfully");
  }

  return browser;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    logger.info("Closing Puppeteer browser");
    await browser.close();
    browser = null;
  }
}

/**
 * Create a new page with default settings
 */
export async function createPage(): Promise<Page> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  // Set viewport
  await page.setViewport({ width: 1280, height: 720 });

  // Set user agent to avoid detection
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Set timeout
  page.setDefaultTimeout(30000);

  return page;
}

/**
 * Navigate to URL with error handling
 */
export async function navigateToUrl(page: Page, url: string): Promise<boolean> {
  try {
    logger.info("Navigating to URL", { url });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    logger.info("Successfully loaded page", { url });
    return true;
  } catch (error) {
    logger.error("Failed to navigate to URL", { url, error });
    return false;
  }
}

/**
 * Take screenshot of page
 */
export async function takeScreenshot(page: Page): Promise<string> {
  const screenshot = await page.screenshot({
    encoding: "base64",
    fullPage: false, // Only visible area
  });

  return screenshot as string;
}

/**
 * Get page HTML content
 */
export async function getPageHtml(page: Page): Promise<string> {
  return await page.content();
}

/**
 * Get page text content
 */
export async function getPageText(page: Page): Promise<string> {
  return await page.evaluate(() => document.body.innerText);
}

/**
 * Click element by selector
 */
export async function clickElement(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    logger.info("Clicked element", { selector });
    return true;
  } catch (error) {
    logger.error("Failed to click element", { selector, error });
    return false;
  }
}

/**
 * Fill input field
 */
export async function fillInput(
  page: Page,
  selector: string,
  value: string
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.type(selector, value);
    logger.info("Filled input", { selector });
    return true;
  } catch (error) {
    logger.error("Failed to fill input", { selector, error });
    return false;
  }
}

/**
 * Select option from dropdown
 */
export async function selectOption(
  page: Page,
  selector: string,
  value: string
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.select(selector, value);
    logger.info("Selected option", { selector, value });
    return true;
  } catch (error) {
    logger.error("Failed to select option", { selector, value, error });
    return false;
  }
}

/**
 * Wait for navigation after action
 */
export async function waitForNavigation(page: Page): Promise<boolean> {
  try {
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 });
    return true;
  } catch (error) {
    logger.error("Navigation timeout", { error });
    return false;
  }
}

/**
 * Check if text exists on page
 */
export async function pageContainsText(
  page: Page,
  text: string
): Promise<boolean> {
  const pageText = await getPageText(page);
  return pageText.toLowerCase().includes(text.toLowerCase());
}

/**
 * Find elements by text content
 */
export async function findElementsByText(
  page: Page,
  text: string
): Promise<string[]> {
  const selectors = await page.evaluate((searchText) => {
    const elements = Array.from(document.querySelectorAll("*"));
    const matches: string[] = [];

    elements.forEach((el) => {
      if (
        el.textContent?.toLowerCase().includes(searchText.toLowerCase()) &&
        el.children.length === 0
      ) {
        // Generate selector
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const classes = el.className
          ? `.${(el.className as string).split(" ").join(".")}`
          : "";
        matches.push(`${tag}${id}${classes}`);
      }
    });

    return matches;
  }, text);

  return selectors;
}

/**
 * Execute JavaScript on page
 */
export async function executeScript(
  page: Page,
  script: string
): Promise<unknown> {
  return await page.evaluate(script);
}
