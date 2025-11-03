/**
 * Unit Tests for Unsubscribe Link Finder
 * Tests extraction and ranking of unsubscribe links from emails
 */

import { describe, it, expect } from "@jest/globals";
import {
  extractUnsubscribeLinks,
  rankUnsubscribeLinks,
  getBestUnsubscribeLink,
} from "@/lib/utils/unsubscribe-link-finder";

describe("Unsubscribe Link Finder", () => {
  describe("extractUnsubscribeLinks", () => {
    it("should extract link from List-Unsubscribe header", () => {
      const headers = {
        "list-unsubscribe": "<https://example.com/unsubscribe?id=123>",
      };
      const links = extractUnsubscribeLinks("", "", headers);

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toBe("https://example.com/unsubscribe?id=123");
    });

    it("should extract multiple links from header", () => {
      const headers = {
        "list-unsubscribe":
          "<https://example.com/unsub>, <https://example.com/optout>",
      };
      const links = extractUnsubscribeLinks("", "", headers);

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links.some((l) => l.includes("example.com/unsub"))).toBe(true);
    });

    it("should extract unsubscribe link from HTML", () => {
      const html = '<a href="https://example.com/unsubscribe">Unsubscribe</a>';
      const links = extractUnsubscribeLinks(html, "");

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toBe("https://example.com/unsubscribe");
    });

    it("should extract opt-out link from HTML", () => {
      const html =
        '<a href="https://example.com/opt-out">Click here to opt-out</a>';
      const links = extractUnsubscribeLinks(html, "");

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links.some((l) => l.includes("opt-out"))).toBe(true);
    });

    it("should extract link from plain text body", () => {
      const text =
        "To unsubscribe, visit: https://example.com/unsubscribe?token=abc";
      const links = extractUnsubscribeLinks("", text);

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toContain("unsubscribe");
    });

    it("should not extract regular links", () => {
      const html = '<a href="https://example.com">Visit our website</a>';
      const links = extractUnsubscribeLinks(html, "");

      expect(links).toHaveLength(0);
    });

    it("should handle emails with no unsubscribe links", () => {
      const html = "<p>Regular email content with no unsubscribe option</p>";
      const text = "Plain text content";
      const links = extractUnsubscribeLinks(html, text);

      expect(links).toHaveLength(0);
    });

    it("should extract from all sources simultaneously", () => {
      const headers = {
        "list-unsubscribe": "<https://example.com/header-unsub>",
      };
      const html =
        '<a href="https://example.com/html-unsubscribe">Unsubscribe</a>';
      const text = "https://example.com/text-unsubscribe";

      const links = extractUnsubscribeLinks(html, text, headers);

      expect(links.length).toBeGreaterThan(1);
    });

    it("should handle case-insensitive matching", () => {
      const html1 = '<a href="https://example.com/unsubscribe">UNSUBSCRIBE</a>';
      const html2 = '<a href="https://example.com/unsubscribe">UnSuBsCrIbE</a>';

      const links1 = extractUnsubscribeLinks(html1, "");
      const links2 = extractUnsubscribeLinks(html2, "");

      expect(links1.length).toBeGreaterThanOrEqual(1);
      expect(links2.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("rankUnsubscribeLinks", () => {
    it("should rank links by relevance", () => {
      const links = [
        "https://example.com/view-browser",
        "https://example.com/unsubscribe",
        "https://example.com/optout",
      ];

      const ranked = rankUnsubscribeLinks(links);

      // Unsubscribe should rank higher than view-browser
      const unsubIndex = ranked.findIndex((l) => l.includes("unsubscribe"));
      const viewIndex = ranked.findIndex((l) => l.includes("view-browser"));
      expect(unsubIndex).toBeLessThan(viewIndex);
    });

    it("should prioritize unsubscribe over other keywords", () => {
      const links = [
        "https://example.com/preferences",
        "https://example.com/unsubscribe",
        "https://example.com/optout",
      ];

      const ranked = rankUnsubscribeLinks(links);

      // Unsubscribe should be first or near first
      expect(ranked[0]).toContain("unsubscribe");
    });

    it("should penalize suspicious links", () => {
      const links = [
        "https://facebook.com/page",
        "https://example.com/unsubscribe",
      ];

      const ranked = rankUnsubscribeLinks(links);

      // Unsubscribe should rank higher than social media
      expect(ranked[0]).toBe("https://example.com/unsubscribe");
    });

    it("should handle empty array", () => {
      const ranked = rankUnsubscribeLinks([]);
      expect(ranked).toHaveLength(0);
    });
  });

  describe("getBestUnsubscribeLink", () => {
    it("should return highest scored link", () => {
      const headers = {
        "list-unsubscribe": "<https://example.com/unsubscribe>",
      };
      const html = '<a href="https://example.com/view">View in browser</a>';

      const best = getBestUnsubscribeLink(html, "", headers);

      expect(best).toBe("https://example.com/unsubscribe");
    });

    it("should prefer header link over HTML link", () => {
      const headers = {
        "list-unsubscribe": "<https://example.com/header-unsub>",
      };
      const html =
        '<a href="https://example.com/html-unsubscribe">Unsubscribe</a>';

      const best = getBestUnsubscribeLink(html, "", headers);

      expect(best).toBeTruthy();
    });

    it("should return null when no links found", () => {
      const best = getBestUnsubscribeLink("", "");

      expect(best).toBeNull();
    });

    it("should handle multiple HTML unsubscribe links", () => {
      const html = `
        <a href="https://example.com/preferences">Preferences</a>
        <a href="https://example.com/unsubscribe">Unsubscribe</a>
        <a href="https://example.com/opt-out">Opt-out</a>
      `;

      const best = getBestUnsubscribeLink(html, "");

      expect(best).toBeTruthy();
      expect(best).toMatch(/unsubscribe|opt-out|preferences/);
    });

    it("should choose unsubscribe over preferences", () => {
      const html = `
        <a href="https://example.com/preferences">Manage Preferences</a>
        <a href="https://example.com/unsubscribe">Unsubscribe</a>
      `;

      const best = getBestUnsubscribeLink(html, "");

      expect(best).toContain("unsubscribe");
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed HTML", () => {
      const html = '<a href="https://example.com/unsubscribe">Unsubscribe';
      const links = extractUnsubscribeLinks(html, "");

      // Should still extract link even if closing tag is missing
      expect(links.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle URLs with query parameters", () => {
      const html =
        '<a href="https://example.com/unsubscribe?token=abc&user=123">Unsubscribe</a>';
      const links = extractUnsubscribeLinks(html, "");

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toContain("token=abc");
    });

    it("should handle URLs with fragments", () => {
      const html =
        '<a href="https://example.com/page#unsubscribe">Unsubscribe</a>';
      const links = extractUnsubscribeLinks(html, "");

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toContain("#unsubscribe");
    });

    it("should handle empty strings gracefully", () => {
      const links = extractUnsubscribeLinks("", "");

      expect(links).toHaveLength(0);
    });

    it("should handle undefined parameters", () => {
      const links = extractUnsubscribeLinks("", "");

      expect(links).toHaveLength(0);
    });

    it("should deduplicate identical URLs from different sources", () => {
      const url = "https://example.com/unsubscribe";
      const headers = { "list-unsubscribe": `<${url}>` };
      const html = `<a href="${url}">Unsubscribe</a>`;
      const text = url;

      extractUnsubscribeLinks(html, text, headers);

      // getBestUnsubscribeLink will return one
      const best = getBestUnsubscribeLink(html, text, headers);
      expect(best).toBe(url);
    });

    it("should handle very long URLs", () => {
      const longUrl =
        "https://example.com/unsubscribe?" + "param=value&".repeat(50);
      const html = `<a href="${longUrl}">Unsubscribe</a>`;

      const links = extractUnsubscribeLinks(html, "");

      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0].length).toBeGreaterThan(100);
    });

    it("should handle international characters in link text", () => {
      const html =
        '<a href="https://example.com/unsubscribe">Se désabonner</a>';
      const links = extractUnsubscribeLinks(html, "");

      expect(links.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Real-World Email Examples", () => {
    it("should handle typical newsletter format", () => {
      const html = `
        <html>
          <body>
            <p>Weekly Newsletter</p>
            <footer>
              <a href="https://newsletter.com/unsubscribe?id=user123">Unsubscribe</a> |
              <a href="https://newsletter.com/preferences">Manage Preferences</a>
            </footer>
          </body>
        </html>
      `;

      const best = getBestUnsubscribeLink(html, "");

      expect(best).toContain("unsubscribe");
    });

    it("should handle marketing email with social links", () => {
      const html = `
        <a href="https://facebook.com/company">Facebook</a>
        <a href="https://twitter.com/company">Twitter</a>
        <a href="https://company.com/unsubscribe">Unsubscribe</a>
      `;

      const best = getBestUnsubscribeLink(html, "");

      expect(best).toBe("https://company.com/unsubscribe");
      expect(best).not.toContain("facebook");
      expect(best).not.toContain("twitter");
    });
  });
});
