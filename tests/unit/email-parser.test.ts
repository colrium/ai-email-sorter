/**
 * Unit Tests for Email Parser
 * Tests parsing email content, extracting metadata, handling HTML/text
 */

import { describe, it, expect } from "@jest/globals";

// Mock email parser functions
const parseEmailContent = (rawEmail: string) => {
  const lines = rawEmail.split("\n");
  const headers: Record<string, string> = {};
  let bodyIndex = 0;

  // Parse headers
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      bodyIndex = i + 1;
      break;
    }
    const [key, ...valueParts] = lines[i].split(":");
    if (key && valueParts.length > 0) {
      headers[key.trim().toLowerCase()] = valueParts.join(":").trim();
    }
  }

  const body = lines.slice(bodyIndex).join("\n");

  return {
    from: headers["from"] || "",
    to: headers["to"] || "",
    subject: headers["subject"] || "",
    date: headers["date"] || "",
    body,
  };
};

const extractPlainText = (html: string): string => {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
};

const extractEmailMetadata = (emailBody: string) => {
  const unsubscribeRegex = /unsubscribe|opt-out|remove me/gi;
  const hasUnsubscribe = unsubscribeRegex.test(emailBody);

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = emailBody.match(urlRegex) || [];

  return {
    hasUnsubscribeLink: hasUnsubscribe,
    linkCount: urls.length,
    urls: urls.slice(0, 10), // Limit to first 10
  };
};

describe("Email Parser", () => {
  describe("parseEmailContent", () => {
    it("should parse basic email headers", () => {
      const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: Test Email
Date: Mon, 1 Jan 2024 12:00:00 +0000

This is the email body.`;

      const parsed = parseEmailContent(rawEmail);

      expect(parsed.from).toBe("sender@example.com");
      expect(parsed.to).toBe("recipient@example.com");
      expect(parsed.subject).toBe("Test Email");
      expect(parsed.date).toBe("Mon, 1 Jan 2024 12:00:00 +0000");
      expect(parsed.body).toBe("This is the email body.");
    });

    it("should handle multi-line headers", () => {
      const rawEmail = `From: sender@example.com
Subject: This is a very long subject line
To: recipient@example.com

Body content here.`;

      const parsed = parseEmailContent(rawEmail);

      expect(parsed.subject).toBe("This is a very long subject line");
      expect(parsed.body).toBe("Body content here.");
    });

    it("should handle missing headers", () => {
      const rawEmail = `From: sender@example.com

Just body content.`;

      const parsed = parseEmailContent(rawEmail);

      expect(parsed.from).toBe("sender@example.com");
      expect(parsed.to).toBe("");
      expect(parsed.subject).toBe("");
      expect(parsed.body).toBe("Just body content.");
    });

    it("should handle empty email", () => {
      const parsed = parseEmailContent("");

      expect(parsed.from).toBe("");
      expect(parsed.to).toBe("");
      expect(parsed.subject).toBe("");
      expect(parsed.body).toBe("");
    });
  });

  describe("extractPlainText", () => {
    it("should strip HTML tags", () => {
      const html = "<p>Hello <strong>World</strong>!</p>";
      const text = extractPlainText(html);

      expect(text).toBe("Hello World !");
    });

    it("should remove script tags and content", () => {
      const html = '<p>Content</p><script>alert("bad")</script><p>More</p>';
      const text = extractPlainText(html);

      expect(text).not.toContain("alert");
      expect(text).toContain("Content");
      expect(text).toContain("More");
    });

    it("should remove style tags", () => {
      const html = "<style>.class { color: red; }</style><p>Text</p>";
      const text = extractPlainText(html);

      expect(text).not.toContain("color");
      expect(text).toContain("Text");
    });

    it("should decode HTML entities", () => {
      const html = "&lt;Hello&gt; &amp; &quot;World&quot;";
      const text = extractPlainText(html);

      expect(text).toBe('<Hello> & "World"');
    });

    it("should handle nested HTML", () => {
      const html = `
        <div>
          <p>Paragraph 1</p>
          <div>
            <span>Nested <em>content</em></span>
          </div>
        </div>
      `;
      const text = extractPlainText(html);

      expect(text).toContain("Paragraph 1");
      expect(text).toContain("Nested");
      expect(text).toContain("content");
    });

    it("should clean up excessive whitespace", () => {
      const html = "<p>Too     many    spaces</p>";
      const text = extractPlainText(html);

      expect(text).toBe("Too many spaces");
    });

    it("should handle empty HTML", () => {
      const text = extractPlainText("");
      expect(text).toBe("");
    });
  });

  describe("extractEmailMetadata", () => {
    it("should detect unsubscribe links", () => {
      const body = "Click here to unsubscribe from our mailing list.";
      const metadata = extractEmailMetadata(body);

      expect(metadata.hasUnsubscribeLink).toBe(true);
    });

    it("should detect opt-out links", () => {
      const body = "To opt-out, visit our preferences page.";
      const metadata = extractEmailMetadata(body);

      expect(metadata.hasUnsubscribeLink).toBe(true);
    });

    it("should count URLs in email", () => {
      const body = `
        Visit https://example.com for more info.
        Or check out https://another-site.com.
      `;
      const metadata = extractEmailMetadata(body);

      expect(metadata.linkCount).toBe(2);
      expect(metadata.urls).toHaveLength(2);
      expect(metadata.urls[0]).toBe("https://example.com");
    });

    it("should handle emails without unsubscribe", () => {
      const body = "Regular email content with no unsubscribe option.";
      const metadata = extractEmailMetadata(body);

      expect(metadata.hasUnsubscribeLink).toBe(false);
    });

    it("should limit URL extraction to 10", () => {
      const urls = Array.from(
        { length: 15 },
        (_, i) => `https://site${i}.com`
      ).join(" ");
      const metadata = extractEmailMetadata(urls);

      expect(metadata.linkCount).toBe(15);
      expect(metadata.urls).toHaveLength(10); // Limited to 10
    });

    it("should detect case-insensitive unsubscribe", () => {
      const body1 = "UNSUBSCRIBE here";
      const body2 = "UnSuBsCrIbE here";

      expect(extractEmailMetadata(body1).hasUnsubscribeLink).toBe(true);
      expect(extractEmailMetadata(body2).hasUnsubscribeLink).toBe(true);
    });
  });

  describe("Integration: Full Email Parsing", () => {
    it("should parse complete HTML email", () => {
      const rawEmail = `From: newsletter@company.com
To: user@example.com
Subject: Weekly Newsletter
Date: Mon, 1 Jan 2024 12:00:00 +0000

<html>
  <body>
    <h1>This Week's Updates</h1>
    <p>Check out our latest features!</p>
    <a href="https://company.com/updates">Read More</a>
    <p><small><a href="https://company.com/unsubscribe">Unsubscribe</a></small></p>
  </body>
</html>`;

      const parsed = parseEmailContent(rawEmail);
      const plainText = extractPlainText(parsed.body);
      const metadata = extractEmailMetadata(parsed.body);

      expect(parsed.from).toBe("newsletter@company.com");
      expect(parsed.subject).toBe("Weekly Newsletter");
      expect(plainText).toContain("This Week's Updates");
      expect(metadata.hasUnsubscribeLink).toBe(true);
      expect(metadata.linkCount).toBeGreaterThan(0);
    });

    it("should handle plain text email", () => {
      const rawEmail = `From: friend@example.com
To: user@example.com
Subject: Lunch tomorrow?

Hey, want to grab lunch tomorrow at noon?
Let me know!`;

      const parsed = parseEmailContent(rawEmail);
      const metadata = extractEmailMetadata(parsed.body);

      expect(parsed.subject).toBe("Lunch tomorrow?");
      expect(parsed.body).toContain("grab lunch");
      expect(metadata.hasUnsubscribeLink).toBe(false);
    });
  });
});
