import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/utils/logger";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface CategorizationResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasoning: string;
}

/**
 * Categorize an email using Claude AI
 */
export async function categorizeEmail(
  email: {
    subject: string;
    from: string;
    snippet: string;
    bodyText: string;
  },
  categories: Category[]
): Promise<CategorizationResult> {
  try {
    if (categories.length === 0) {
      throw new Error("No categories provided for categorization");
    }

    // Build prompt
    const categoriesText = categories
      .map((c) => `- "${c.name}": ${c.description || "No description"}`)
      .join("\n");

    const prompt = `You are an email categorization assistant. Analyze the email below and categorize it into the BEST matching category.

USER'S CATEGORIES:
${categoriesText}

EMAIL TO CATEGORIZE:
From: ${email.from}
Subject: ${email.subject}
Preview: ${email.snippet}
Body: ${email.bodyText.substring(0, 1000)}

Rules:
1. Choose the BEST matching category from the list above
2. If multiple categories match, choose the most specific one
3. Consider the sender, subject, and content
4. Provide a confidence score (0-100)
5. Explain your reasoning briefly

Respond with ONLY valid JSON in this exact format:
{
  "categoryName": "exact category name from the list",
  "confidence": 85,
  "reasoning": "Brief explanation of why this category was chosen"
}`;

    logger.info("Calling Claude for email categorization", {
      subject: email.subject,
      categoriesCount: categories.length,
    });

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Parse response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    logger.info("Claude categorization response", { response: responseText });

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from Claude");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Find matching category
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === result.categoryName.toLowerCase()
    );

    if (!matchedCategory) {
      // Default to first category if no match
      logger.warn("Category not found in list, using first category", {
        suggestedCategory: result.categoryName,
      });
      return {
        categoryId: categories[0].id,
        categoryName: categories[0].name,
        confidence: 50,
        reasoning: result.reasoning || "Default categorization",
      };
    }

    return {
      categoryId: matchedCategory.id,
      categoryName: matchedCategory.name,
      confidence: result.confidence || 75,
      reasoning: result.reasoning || "AI categorization",
    };
  } catch (error) {
    logger.error("Failed to categorize email with Claude", { error });

    // Fallback to first category
    if (categories.length > 0) {
      return {
        categoryId: categories[0].id,
        categoryName: categories[0].name,
        confidence: 50,
        reasoning: "Fallback categorization due to error",
      };
    }

    throw error;
  }
}

/**
 * Summarize an email using Claude AI
 */
export async function summarizeEmail(email: {
  subject: string;
  from: string;
  bodyText: string;
}): Promise<string> {
  try {
    const prompt = `Summarize this email in 2-3 clear, concise sentences. Focus on:
- Main action items or requests
- Key information
- Deadlines (if mentioned)

EMAIL:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyText.substring(0, 2000)}

Provide ONLY the summary text, no preamble or extra formatting.`;

    logger.info("Calling Claude for email summarization", {
      subject: email.subject,
    });

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const summary =
      message.content[0].type === "text" ? message.content[0].text : "";

    logger.info("Claude summarization complete", {
      subject: email.subject,
      summaryLength: summary.length,
    });

    return summary.trim();
  } catch (error) {
    logger.error("Failed to summarize email with Claude", { error });

    // Fallback to snippet or first 200 chars
    return email.bodyText.substring(0, 200) + "...";
  }
}
