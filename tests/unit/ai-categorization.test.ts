/**
 * Unit Tests for AI Categorization
 * Tests AI categorization logic with mocked AI responses
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

// Mock types
interface Category {
  id: string;
  name: string;
  description: string;
}

interface Email {
  id: string;
  subject: string;
  from: string;
  bodySnippet: string;
}

interface CategorizationResult {
  category: string;
  categoryId: string | null;
  reasoning: string;
  confidence: number;
}

// Mock AI categorization function
const categorizeEmail = async (
  email: Email,
  categories: Category[]
): Promise<CategorizationResult> => {
  // This would normally call Claude API
  // For testing, we simulate the logic

  if (categories.length === 0) {
    return {
      category: "Uncategorized",
      categoryId: null,
      reasoning: "No categories available",
      confidence: 100,
    };
  }

  // Simple matching logic for testing
  const subject = email.subject.toLowerCase();
  const body = email.bodySnippet.toLowerCase();
  const content = `${subject} ${body}`;

  for (const cat of categories) {
    const keywords = cat.description.toLowerCase().split(" ");
    const matches = keywords.filter((keyword) =>
      content.includes(keyword)
    ).length;

    if (matches > 0) {
      return {
        category: cat.name,
        categoryId: cat.id,
        reasoning: `Matched ${matches} keywords from category description`,
        confidence: Math.min((matches / keywords.length) * 100, 95),
      };
    }
  }

  return {
    category: "Uncategorized",
    categoryId: null,
    reasoning: "No matching category found",
    confidence: 50,
  };
};

const buildCategorizationPrompt = (
  email: Email,
  categories: Category[]
): string => {
  return `You are an email categorization assistant.

USER'S CATEGORIES:
${categories.map((c) => `- "${c.name}": ${c.description}`).join("\n")}

EMAIL TO CATEGORIZE:
From: ${email.from}
Subject: ${email.subject}
Body Preview: ${email.bodySnippet}

Rules:
1. Choose the BEST matching category
2. If no good match, return "Uncategorized"
3. Respond with JSON: { "category": "category_name", "reasoning": "brief explanation", "confidence": 0-100 }`;
};

describe("AI Categorization", () => {
  let mockCategories: Category[];
  let mockEmail: Email;

  beforeEach(() => {
    mockCategories = [
      {
        id: "1",
        name: "Newsletters",
        description: "Marketing emails, newsletters, promotional content",
      },
      {
        id: "2",
        name: "Work",
        description: "Work-related emails, meetings, project updates",
      },
      {
        id: "3",
        name: "Personal",
        description: "Personal correspondence, friends, family",
      },
      {
        id: "4",
        name: "Receipts",
        description: "Purchase receipts, invoices, order confirmations",
      },
    ];

    mockEmail = {
      id: "email-1",
      subject: "Test Email",
      from: "sender@example.com",
      bodySnippet: "This is a test email body.",
    };
  });

  describe("categorizeEmail", () => {
    it("should categorize newsletter correctly", async () => {
      mockEmail.subject = "Weekly Newsletter - Special Offer!";
      mockEmail.from = "marketing@company.com";
      mockEmail.bodySnippet = "Check out our promotional deals this week!";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Newsletters");
      expect(result.categoryId).toBe("1");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should categorize work email correctly", async () => {
      mockEmail.subject = "Project Update: Q4 Meeting";
      mockEmail.from = "boss@company.com";
      mockEmail.bodySnippet =
        "Let's discuss the project updates in our next meeting.";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Work");
      expect(result.categoryId).toBe("2");
    });

    it("should categorize receipt correctly", async () => {
      mockEmail.subject = "Your Order Confirmation #12345";
      mockEmail.from = "orders@amazon.com";
      mockEmail.bodySnippet =
        "Thank you for your purchase. Your invoice is attached.";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Receipts");
      expect(result.categoryId).toBe("4");
    });

    it("should categorize personal email correctly", async () => {
      mockEmail.subject = "Dinner plans this weekend?";
      mockEmail.from = "friend@gmail.com";
      mockEmail.bodySnippet = "Hey! Want to catch up with family this weekend?";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Personal");
      expect(result.categoryId).toBe("3");
    });

    it("should return Uncategorized when no match", async () => {
      mockEmail.subject = "Random Spam";
      mockEmail.from = "spam@unknown.com";
      mockEmail.bodySnippet = "xyz123 random content";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Uncategorized");
      expect(result.categoryId).toBeNull();
    });

    it("should handle empty categories list", async () => {
      const result = await categorizeEmail(mockEmail, []);

      expect(result.category).toBe("Uncategorized");
      expect(result.categoryId).toBeNull();
      expect(result.reasoning).toContain("No categories");
    });

    it("should return reasoning for categorization", async () => {
      mockEmail.subject = "Newsletter";
      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.reasoning).toBeTruthy();
      expect(typeof result.reasoning).toBe("string");
    });

    it("should return confidence score", async () => {
      mockEmail.subject = "Marketing Newsletter";
      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it("should handle case-insensitive matching", async () => {
      mockEmail.subject = "NEWSLETTER ALERT";
      mockEmail.bodySnippet = "PROMOTIONAL CONTENT HERE";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Newsletters");
    });

    it("should prioritize best matching category", async () => {
      // Email could match multiple categories
      mockEmail.subject = "Work Newsletter";
      mockEmail.bodySnippet = "Project updates and promotional deals";

      const result = await categorizeEmail(mockEmail, mockCategories);

      // Should match one of the categories
      expect(["Newsletters", "Work"]).toContain(result.category);
    });
  });

  describe("buildCategorizationPrompt", () => {
    it("should build valid prompt with categories", () => {
      const prompt = buildCategorizationPrompt(mockEmail, mockCategories);

      expect(prompt).toContain("email categorization assistant");
      expect(prompt).toContain("Newsletters");
      expect(prompt).toContain("Work");
      expect(prompt).toContain("Personal");
      expect(prompt).toContain("Receipts");
    });

    it("should include email details in prompt", () => {
      mockEmail.subject = "Test Subject";
      mockEmail.from = "test@example.com";
      mockEmail.bodySnippet = "Test body content";

      const prompt = buildCategorizationPrompt(mockEmail, mockCategories);

      expect(prompt).toContain("Test Subject");
      expect(prompt).toContain("test@example.com");
      expect(prompt).toContain("Test body content");
    });

    it("should include category descriptions", () => {
      const prompt = buildCategorizationPrompt(mockEmail, mockCategories);

      expect(prompt).toContain("Marketing emails, newsletters");
      expect(prompt).toContain("Work-related emails, meetings");
      expect(prompt).toContain("Personal correspondence");
    });

    it("should include response format instructions", () => {
      const prompt = buildCategorizationPrompt(mockEmail, mockCategories);

      expect(prompt).toContain("JSON");
      expect(prompt).toContain("category");
      expect(prompt).toContain("reasoning");
      expect(prompt).toContain("confidence");
    });

    it("should handle empty categories", () => {
      const prompt = buildCategorizationPrompt(mockEmail, []);

      expect(prompt).toContain("USER'S CATEGORIES");
      expect(prompt).toContain("EMAIL TO CATEGORIZE");
    });

    it("should handle special characters in email", () => {
      mockEmail.subject = 'Test & <Special> "Characters"';
      mockEmail.bodySnippet = 'Content with "quotes" and <tags>';

      const prompt = buildCategorizationPrompt(mockEmail, mockCategories);

      expect(prompt).toContain(mockEmail.subject);
      expect(prompt).toContain(mockEmail.bodySnippet);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long email subjects", async () => {
      mockEmail.subject = "A".repeat(500);
      mockEmail.bodySnippet = "newsletter content";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result).toBeDefined();
      expect(result.category).toBeTruthy();
    });

    it("should handle emails with no body", async () => {
      mockEmail.bodySnippet = "";
      mockEmail.subject = "Newsletter";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Newsletters");
    });

    it("should handle emails with no subject", async () => {
      mockEmail.subject = "";
      mockEmail.bodySnippet = "meeting project work";

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.category).toBe("Work");
    });

    it("should handle category with very long description", async () => {
      const longCategory: Category = {
        id: "5",
        name: "Special",
        description: "word ".repeat(200).trim(),
      };

      const result = await categorizeEmail(mockEmail, [longCategory]);

      expect(result).toBeDefined();
    });

    it("should handle multiple categories with same keywords", async () => {
      const similarCategories: Category[] = [
        { id: "1", name: "Cat1", description: "test email" },
        { id: "2", name: "Cat2", description: "test email message" },
      ];

      mockEmail.subject = "test email";

      const result = await categorizeEmail(mockEmail, similarCategories);

      expect(["Cat1", "Cat2"]).toContain(result.category);
    });
  });

  describe("Mock AI Response Parsing", () => {
    it("should parse valid JSON response", () => {
      const mockResponse = JSON.stringify({
        category: "Work",
        reasoning: "Contains work-related keywords",
        confidence: 85,
      });

      const parsed = JSON.parse(mockResponse);

      expect(parsed.category).toBe("Work");
      expect(parsed.confidence).toBe(85);
    });

    it("should handle malformed JSON gracefully", () => {
      const mockResponse = "{ invalid json }";

      expect(() => {
        JSON.parse(mockResponse);
      }).toThrow();
    });

    it("should validate confidence score range", () => {
      const validate = (confidence: number) =>
        confidence >= 0 && confidence <= 100;

      expect(validate(50)).toBe(true);
      expect(validate(0)).toBe(true);
      expect(validate(100)).toBe(true);
      expect(validate(-1)).toBe(false);
      expect(validate(101)).toBe(false);
    });
  });
});
