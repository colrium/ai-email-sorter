/**
 * AI-Powered Unsubscribe Agent
 * Uses Claude AI to analyze pages and determine unsubscribe actions
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/utils/logger";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface UnsubscribeAction {
  type: "click" | "fill" | "select" | "submit" | "wait";
  selector?: string;
  value?: string;
  description: string;
}

export interface UnsubscribeAnalysis {
  canUnsubscribe: boolean;
  confidence: number;
  actions: UnsubscribeAction[];
  reasoning: string;
  successIndicators: string[];
}

/**
 * Analyze unsubscribe page and determine actions to take
 */
export async function analyzeUnsubscribePage(
  html: string,
  pageText: string,
  url: string
): Promise<UnsubscribeAnalysis> {
  try {
    logger.info("Analyzing unsubscribe page with AI", { url });

    const prompt = buildUnsubscribePrompt(html, pageText, url);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error("Failed to extract JSON from AI response", {
        response: content.text,
      });
      return {
        canUnsubscribe: false,
        confidence: 0,
        actions: [],
        reasoning: "Failed to parse AI response",
        successIndicators: [],
      };
    }

    const analysis = JSON.parse(jsonMatch[0]) as UnsubscribeAnalysis;

    logger.info("Unsubscribe analysis complete", {
      url,
      canUnsubscribe: analysis.canUnsubscribe,
      confidence: analysis.confidence,
      actionCount: analysis.actions.length,
    });

    return analysis;
  } catch (error) {
    logger.error("Failed to analyze unsubscribe page", { url, error });
    return {
      canUnsubscribe: false,
      confidence: 0,
      actions: [],
      reasoning: `Analysis failed: ${error}`,
      successIndicators: [],
    };
  }
}

/**
 * Build prompt for AI analysis
 */
function buildUnsubscribePrompt(
  html: string,
  pageText: string,
  url: string
): string {
  // Truncate HTML if too long (Claude has token limits)
  const truncatedHtml =
    html.length > 10000 ? html.substring(0, 10000) + "..." : html;

  return `You are an automated unsubscribe agent. Analyze this webpage and determine how to unsubscribe from emails.

URL: ${url}

PAGE TEXT:
${pageText.substring(0, 2000)}

HTML STRUCTURE (truncated):
${truncatedHtml}

TASK:
Analyze this page and provide step-by-step actions to unsubscribe. Look for:
1. Unsubscribe buttons or links
2. Forms that need to be filled
3. Confirmation dialogs
4. Email address fields
5. Checkboxes or radio buttons
6. Submit buttons

IMPORTANT RULES:
- Only provide actions you're confident will work
- Prioritize simple one-click unsubscribe over complex forms
- Look for "unsubscribe all" or "remove from all lists" options
- Avoid actions that might accidentally subscribe or opt-in
- Be cautious with forms - only fill if absolutely necessary

RESPONSE FORMAT (JSON only):
{
  "canUnsubscribe": boolean,
  "confidence": number (0-100),
  "actions": [
    {
      "type": "click" | "fill" | "select" | "submit" | "wait",
      "selector": "CSS selector for the element",
      "value": "value to enter (for fill/select types)",
      "description": "human-readable description of this action"
    }
  ],
  "reasoning": "brief explanation of your analysis",
  "successIndicators": ["text to look for confirming success"]
}

EXAMPLES OF ACTIONS:
- Click unsubscribe button: {"type": "click", "selector": "button[id='unsubscribe']", "description": "Click the unsubscribe button"}
- Fill email: {"type": "fill", "selector": "input[type='email']", "value": "{{EMAIL}}", "description": "Enter email address"}
- Select reason: {"type": "select", "selector": "select[name='reason']", "value": "not-interested", "description": "Select reason"}
- Submit form: {"type": "submit", "selector": "form#unsubscribe-form", "description": "Submit the form"}

Return ONLY the JSON object, no additional text.`;
}

/**
 * Verify if unsubscribe was successful
 */
export async function verifyUnsubscribeSuccess(
  pageText: string,
  successIndicators: string[]
): Promise<boolean> {
  const lowerPageText = pageText.toLowerCase();

  // Default success patterns
  const defaultPatterns = [
    "successfully unsubscribed",
    "you have been unsubscribed",
    "you will no longer receive",
    "removed from our list",
    "unsubscribe successful",
    "you're unsubscribed",
    "successfully removed",
    "opted out",
    "preferences updated",
  ];

  // Check AI-provided indicators
  for (const indicator of successIndicators) {
    if (lowerPageText.includes(indicator.toLowerCase())) {
      logger.info("Found success indicator", { indicator });
      return true;
    }
  }

  // Check default patterns
  for (const pattern of defaultPatterns) {
    if (lowerPageText.includes(pattern)) {
      logger.info("Found default success pattern", { pattern });
      return true;
    }
  }

  return false;
}

/**
 * Analyze simple one-click unsubscribe (mailto: links)
 */
export async function analyzeMailtoUnsubscribe(
  mailto: string
): Promise<UnsubscribeAnalysis> {
  // mailto: links are simple - just need to send email
  return {
    canUnsubscribe: true,
    confidence: 95,
    actions: [
      {
        type: "click",
        description: `Send email to ${mailto}`,
      },
    ],
    reasoning: "Simple mailto: unsubscribe link found",
    successIndicators: ["email sent"],
  };
}
