import { getGmailApi } from "./client";
import { logger } from "@/lib/utils/logger";
import { gmail_v1 } from "googleapis";

export interface EmailData {
  gmailMessageId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  labels: string[];
  hasAttachments: boolean;
  unsubscribeLink: string | null;
}

/**
 * Parse email message from Gmail API response
 */
function parseEmailMessage(message: gmail_v1.Schema$Message): EmailData {
  const headers = message.payload?.headers || [];

  const getHeader = (name: string): string => {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || "";
  };

  // Extract body
  let bodyText = "";
  let bodyHtml = "";

  const extractBody = (part: gmail_v1.Schema$MessagePart) => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      bodyHtml = Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  if (message.payload) {
    if (message.payload.body?.data) {
      bodyText = Buffer.from(message.payload.body.data, "base64").toString(
        "utf-8"
      );
    }
    if (message.payload.parts) {
      message.payload.parts.forEach(extractBody);
    }
  }

  // Extract unsubscribe link
  let unsubscribeLink: string | null = null;
  const unsubscribeHeader = getHeader("List-Unsubscribe");
  if (unsubscribeHeader) {
    const urlMatch = unsubscribeHeader.match(/<(https?:\/\/[^>]+)>/);
    if (urlMatch) {
      unsubscribeLink = urlMatch[1];
    }
  }

  // Check for unsubscribe link in body
  if (!unsubscribeLink && bodyHtml) {
    const unsubscribeMatch = bodyHtml.match(
      /<a[^>]+href=["']([^"']*unsubscribe[^"']*)["'][^>]*>/i
    );
    if (unsubscribeMatch) {
      unsubscribeLink = unsubscribeMatch[1];
    }
  }

  return {
    gmailMessageId: message.id!,
    threadId: message.threadId!,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    to: getHeader("To"),
    date: new Date(parseInt(message.internalDate || "0")),
    snippet: message.snippet || "",
    bodyText: bodyText || message.snippet || "",
    bodyHtml,
    labels: message.labelIds || [],
    hasAttachments:
      message.payload?.parts?.some(
        (part) => part.filename && part.filename.length > 0
      ) || false,
    unsubscribeLink,
  };
}

/**
 * Fetch emails from Gmail for a specific account
 */
export async function fetchEmails(
  accountId: string,
  options: {
    maxResults?: number;
    query?: string;
    pageToken?: string;
  } = {}
): Promise<{ emails: EmailData[]; nextPageToken?: string }> {
  try {
    const gmail = await getGmailApi(accountId);
    const { maxResults = 50, query = "in:inbox", pageToken } = options;

    logger.info("Fetching emails from Gmail", { accountId, maxResults, query });

    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: query,
      pageToken,
    });

    const messageIds = listResponse.data.messages || [];
    logger.info(`Found ${messageIds.length} messages`, { accountId });

    // Fetch full message details in parallel (batch of 10 at a time)
    const emails: EmailData[] = [];
    const batchSize = 10;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (msg) => {
        try {
          const messageResponse = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "full",
          });
          return parseEmailMessage(messageResponse.data);
        } catch (error) {
          logger.error("Failed to fetch message", { error, messageId: msg.id });
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      emails.push(...batchResults.filter((e): e is EmailData => e !== null));
    }

    logger.info("Successfully fetched emails", {
      accountId,
      count: emails.length,
    });

    return {
      emails,
      nextPageToken: listResponse.data.nextPageToken || undefined,
    };
  } catch (error) {
    logger.error("Failed to fetch emails", { error, accountId });
    throw error;
  }
}

/**
 * Fetch a single email by ID
 */
export async function fetchEmailById(
  accountId: string,
  messageId: string
): Promise<EmailData | null> {
  try {
    const gmail = await getGmailApi(accountId);
    const messageResponse = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    return parseEmailMessage(messageResponse.data);
  } catch (error) {
    logger.error("Failed to fetch email by ID", {
      error,
      accountId,
      messageId,
    });
    return null;
  }
}

/**
 * Archive an email in Gmail (remove INBOX label)
 */
export async function archiveEmail(
  accountId: string,
  messageId: string
): Promise<boolean> {
  try {
    const gmail = await getGmailApi(accountId);
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        removeLabelIds: ["INBOX"],
      },
    });

    logger.info("Email archived in Gmail", { accountId, messageId });
    return true;
  } catch (error) {
    logger.error("Failed to archive email", { error, accountId, messageId });
    return false;
  }
}

/**
 * Delete an email from Gmail permanently
 */
export async function deleteEmail(
  accountId: string,
  messageId: string
): Promise<boolean> {
  try {
    const gmail = await getGmailApi(accountId);
    await gmail.users.messages.trash({
      userId: "me",
      id: messageId,
    });

    logger.info("Email moved to trash in Gmail", { accountId, messageId });
    return true;
  } catch (error) {
    logger.error("Failed to delete email", { error, accountId, messageId });
    return false;
  }
}
