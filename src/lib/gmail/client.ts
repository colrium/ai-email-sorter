import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/db/prisma";
import { decrypt, encrypt } from "@/lib/utils/encryption";
import { logger } from "@/lib/utils/logger";

export interface GmailClientConfig {
  accountId: string;
}

/**
 * Create a Gmail API client for a specific account
 */
export async function createGmailClient(
  accountId: string
): Promise<OAuth2Client> {
  try {
    // Fetch account from database
    const account = await prisma.gmailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Gmail account not found: ${accountId}`);
    }

    // Decrypt tokens
    const accessToken = decrypt(account.accessToken);
    const refreshToken = account.refreshToken
      ? decrypt(account.refreshToken)
      : null;

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: account.tokenExpiry?.getTime(),
    });

    // Set up token refresh handler
    oauth2Client.on("tokens", async (tokens) => {
      logger.info("Gmail tokens refreshed", { accountId });

      const updateData: {
        accessToken: string;
        refreshToken?: string;
        tokenExpiry: Date | null;
      } = {
        accessToken: encrypt(tokens.access_token!),
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      };

      if (tokens.refresh_token) {
        updateData.refreshToken = encrypt(tokens.refresh_token);
      }

      await prisma.gmailAccount.update({
        where: { id: accountId },
        data: updateData,
      });
    });

    return oauth2Client;
  } catch (error) {
    logger.error("Failed to create Gmail client", { error, accountId });
    throw error;
  }
}

/**
 * Get Gmail API instance for an account
 */
export async function getGmailApi(accountId: string) {
  const auth = await createGmailClient(accountId);
  return google.gmail({ version: "v1", auth });
}

/**
 * Test Gmail API connection
 */
export async function testGmailConnection(accountId: string): Promise<boolean> {
  try {
    const gmail = await getGmailApi(accountId);
    const response = await gmail.users.getProfile({ userId: "me" });
    logger.info("Gmail connection test successful", {
      accountId,
      emailAddress: response.data.emailAddress,
    });
    return true;
  } catch (error) {
    logger.error("Gmail connection test failed", { error, accountId });
    return false;
  }
}
