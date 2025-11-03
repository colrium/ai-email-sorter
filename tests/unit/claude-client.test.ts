import { jest } from "@jest/globals";

// Mock Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

jest.mock("@/lib/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

interface Category {
  id: string;
  name: string;
  description: string;
}

interface ErrorWithStatus extends Error {
  status?: number;
}

interface CategorizationResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasoning: string;
}

describe("Claude AI Client", () => {
  let categorizeEmail: (
    email: { subject: string; from: string; snippet: string; bodyText: string },
    categories: Category[]
  ) => Promise<CategorizationResult>;
  let summarizeEmail: (email: {
    subject: string;
    from: string;
    bodyText: string;
  }) => Promise<string>;
  let mockAnthropicCreate: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import module after mocks
    const claudeModule = await import("@/lib/ai/claude-client");
    categorizeEmail = claudeModule.categorizeEmail;
    summarizeEmail = claudeModule.summarizeEmail;

    // Get mocked Anthropic instance
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropicInstance = new Anthropic({ apiKey: "test-key" });
    mockAnthropicCreate = anthropicInstance.messages
      .create as unknown as jest.Mock;
  });

  describe("categorizeEmail", () => {
    const mockEmail = {
      subject: "Team Meeting Tomorrow",
      from: "boss@company.com",
      snippet: "Please attend the team meeting...",
      bodyText: "Please attend the team meeting at 2 PM tomorrow.",
    };

    const mockCategories = [
      { id: "cat-1", name: "Work", description: "Work-related emails" },
      { id: "cat-2", name: "Personal", description: "Personal emails" },
    ];

    it("should categorize email successfully with JSON response", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              category: "Work",
              confidence: 0.95,
              reasoning: "This is a work meeting invitation",
            }),
          },
        ],
      };

      mockAnthropicCreate.mockResolvedValue(mockResponse);

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result).toEqual({
        categoryId: "cat-1",
        categoryName: "Work",
        confidence: 0.95,
        reasoning: "This is a work meeting invitation",
      });
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-3-5-20241022",
          max_tokens: 200,
        })
      );
    });

    it("should handle plain text category name response", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: "Work",
          },
        ],
      };

      mockAnthropicCreate.mockResolvedValue(mockResponse);

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.categoryName).toBe("Work");
      expect(result.categoryId).toBe("cat-1");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should fallback to first category on error", async () => {
      (mockAnthropicCreate as jest.Mock).mockRejectedValue(
        new Error("API Error")
      );

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe("cat-1");
      expect(result.categoryName).toBe("Work");
      expect(result.confidence).toBe(0.5);
    });

    it("should handle invalid category name by using first category", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              category: "NonExistentCategory",
              confidence: 0.8,
              reasoning: "Some reasoning",
            }),
          },
        ],
      };

      mockAnthropicCreate.mockResolvedValue(mockResponse);

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe("cat-1");
      expect(result.confidence).toBeLessThan(0.8); // Reduced due to fallback
    });

    it("should handle empty categories array", async () => {
      await expect(categorizeEmail(mockEmail, [])).rejects.toThrow(
        "No categories available"
      );
    });

    it("should include email content in prompt", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "Work" }],
      };

      (mockAnthropicCreate as jest.Mock).mockResolvedValue(mockResponse);

      await categorizeEmail(mockEmail, mockCategories);

      interface CallArgs {
        messages: Array<{ content: string }>;
      }
      const callArgs = mockAnthropicCreate.mock.calls[0][0] as CallArgs;
      const userMessage = callArgs.messages[0].content;

      expect(userMessage).toContain(mockEmail.subject);
      expect(userMessage).toContain(mockEmail.from);
      expect(userMessage).toContain(mockEmail.bodyText);
      expect(userMessage).toContain("Work");
      expect(userMessage).toContain("Personal");
    });
  });

  describe("summarizeEmail", () => {
    const mockEmail = {
      subject: "Project Update",
      from: "manager@company.com",
      bodyText:
        "The Q4 project is on track. We completed 80% of deliverables. Next milestone is Dec 15. Please review the attached report.",
      bodyHtml: "<p>The Q4 project is on track...</p>",
    };

    it("should generate summary successfully", async () => {
      const mockSummary =
        "Q4 project is 80% complete with next milestone on Dec 15. Manager requests report review.";

      const mockResponse = {
        content: [
          {
            type: "text",
            text: mockSummary,
          },
        ],
      };

      (mockAnthropicCreate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await summarizeEmail(mockEmail);

      expect(result).toBe(mockSummary);
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-3-5-20241022",
          max_tokens: 300,
        })
      );
    });

    it("should use subject as fallback on error", async () => {
      (mockAnthropicCreate as jest.Mock).mockRejectedValue(
        new Error("API Error")
      );

      const result = await summarizeEmail(mockEmail);

      expect(result).toBe(mockEmail.subject);
    });

    it("should handle HTML-only email body", async () => {
      const emailWithHtmlOnly = {
        subject: "HTML Email",
        from: "sender@test.com",
        bodyText: "<html content stripped>",
      };

      const mockResponse = {
        content: [{ type: "text", text: "Summary of HTML content" }],
      };

      (mockAnthropicCreate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await summarizeEmail(emailWithHtmlOnly);

      expect(result).toBe("Summary of HTML content");
    });

    it("should handle empty email body", async () => {
      const emptyEmail = {
        subject: "Empty Email",
        from: "test@test.com",
        bodyText: "",
        bodyHtml: "",
      };

      const mockResponse = {
        content: [{ type: "text", text: emptyEmail.subject }],
      };

      (mockAnthropicCreate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await summarizeEmail(emptyEmail);

      expect(result).toBeTruthy();
    });

    it("should limit summary to reasonable length", async () => {
      const longSummary = "A".repeat(1000);

      const mockResponse = {
        content: [{ type: "text", text: longSummary }],
      };

      (mockAnthropicCreate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await summarizeEmail(mockEmail);

      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("Error Handling", () => {
    const mockEmail = {
      subject: "Test",
      from: "test@test.com",
      snippet: "Test snippet",
      bodyText: "Test body",
    };

    const mockCategories = [
      { id: "cat-1", name: "Test", description: "Test category" },
    ];

    it("should handle rate limit errors", async () => {
      const rateLimitError: ErrorWithStatus = new Error("Rate limit exceeded");
      rateLimitError.status = 429;

      (mockAnthropicCreate as jest.Mock).mockRejectedValue(rateLimitError);

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe("cat-1");
      expect(result.confidence).toBe(0.5);
    });

    it("should handle API key errors", async () => {
      const authError: ErrorWithStatus = new Error("Invalid API key");
      authError.status = 401;

      (mockAnthropicCreate as jest.Mock).mockRejectedValue(authError);

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe("cat-1");
    });

    it("should handle malformed JSON response", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: "{ invalid json",
          },
        ],
      };

      (mockAnthropicCreate as jest.Mock).mockResolvedValue(mockResponse);

      const result = await categorizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe("cat-1");
    });
  });
});
