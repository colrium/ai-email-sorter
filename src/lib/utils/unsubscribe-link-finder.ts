/**
 * Unsubscribe Link Finder Utility
 * Extracts unsubscribe links from email content and headers
 */

/**
 * Extract unsubscribe links from email HTML body
 */
export function extractUnsubscribeLinks(
  bodyHtml: string,
  bodyText: string,
  headers?: Record<string, string>
): string[] {
  const links: string[] = [];

  // 1. Check List-Unsubscribe header (RFC 2369)
  if (headers?.["list-unsubscribe"]) {
    const headerLinks = parseListUnsubscribeHeader(headers["list-unsubscribe"]);
    links.push(...headerLinks);
  }

  // 2. Parse HTML for unsubscribe links
  if (bodyHtml) {
    const htmlLinks = parseHtmlForUnsubscribeLinks(bodyHtml);
    links.push(...htmlLinks);
  }

  // 3. Parse text body for unsubscribe URLs
  if (bodyText) {
    const textLinks = parseTextForUnsubscribeLinks(bodyText);
    links.push(...textLinks);
  }

  // Remove duplicates and filter valid URLs
  return [...new Set(links)].filter(isValidUrl);
}

/**
 * Parse List-Unsubscribe header
 * Format: <mailto:unsubscribe@example.com>, <https://example.com/unsub>
 */
function parseListUnsubscribeHeader(header: string): string[] {
  const links: string[] = [];
  const regex = /<(https?:\/\/[^>]+)>/gi;
  let match;

  while ((match = regex.exec(header)) !== null) {
    links.push(match[1]);
  }

  return links;
}

/**
 * Parse HTML body for unsubscribe links
 */
function parseHtmlForUnsubscribeLinks(html: string): string[] {
  const links: string[] = [];

  // Common unsubscribe patterns in href attributes
  const patterns = [
    /href=["'](https?:\/\/[^"']*unsubscribe[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*opt-out[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*remove[^"']*)["']/gi,
    /href=["'](https?:\/\/[^"']*preferences[^"']*)["']/gi,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      links.push(match[1]);
    }
  });

  // Also check for links with unsubscribe text
  const linkWithTextPattern =
    /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?(unsubscribe|opt.?out|remove|preferences)[\s\S]*?<\/a>/gi;
  let match;
  while ((match = linkWithTextPattern.exec(html)) !== null) {
    links.push(match[1]);
  }

  return links;
}

/**
 * Parse plain text for unsubscribe URLs
 */
function parseTextForUnsubscribeLinks(text: string): string[] {
  const links: string[] = [];

  // Find URLs near unsubscribe keywords
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();

    if (
      lowerLine.includes("unsubscribe") ||
      lowerLine.includes("opt out") ||
      lowerLine.includes("opt-out") ||
      lowerLine.includes("remove") ||
      lowerLine.includes("preferences")
    ) {
      // Check this line and next few lines for URLs
      const contextLines = lines.slice(index, index + 3).join(" ");
      const urlMatches = contextLines.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/g);

      if (urlMatches) {
        links.push(...urlMatches);
      }
    }
  });

  return links;
}

/**
 * Validate URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Rank unsubscribe links by likelihood of being the correct link
 */
export function rankUnsubscribeLinks(links: string[]): string[] {
  return links.sort((a, b) => {
    const scoreA = getLinkScore(a);
    const scoreB = getLinkScore(b);
    return scoreB - scoreA; // Higher score first
  });
}

/**
 * Score a link based on URL patterns
 */
function getLinkScore(url: string): number {
  let score = 0;
  const lower = url.toLowerCase();

  // Positive indicators
  if (lower.includes("unsubscribe")) score += 10;
  if (lower.includes("opt-out") || lower.includes("optout")) score += 8;
  if (lower.includes("remove")) score += 6;
  if (lower.includes("preferences")) score += 5;
  if (lower.includes("email-preferences")) score += 7;

  // Negative indicators (likely not unsubscribe links)
  if (lower.includes("view") || lower.includes("browser")) score -= 5;
  if (lower.includes("forward")) score -= 5;
  if (lower.includes("social")) score -= 3;
  if (lower.includes("facebook") || lower.includes("twitter")) score -= 5;

  // Prefer shorter, cleaner URLs
  if (url.length < 100) score += 2;
  if (url.length > 200) score -= 2;

  return score;
}

/**
 * Get the best unsubscribe link from an email
 */
export function getBestUnsubscribeLink(
  bodyHtml: string,
  bodyText: string,
  headers?: Record<string, string>
): string | null {
  const links = extractUnsubscribeLinks(bodyHtml, bodyText, headers);

  if (links.length === 0) {
    return null;
  }

  const rankedLinks = rankUnsubscribeLinks(links);
  return rankedLinks[0];
}
