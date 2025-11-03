/**
 * API Route: OAuth Callback for Additional Gmail Account
 * GET /api/accounts/connect/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { google } from "googleapis";
import { prisma } from "@/lib/db/prisma";
import { encrypt } from "@/lib/utils/encryption";
import { setupGmailWatch } from "@/lib/gmail/watch-service";
import { logger } from "@/lib/utils/logger";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", request.url)
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      logger.error("OAuth callback error", { error });
      return NextResponse.redirect(
        new URL(`/settings?error=${error}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/settings?error=no_code", request.url)
      );
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/accounts/connect/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("Failed to get access token");
    }

    oauth2Client.setCredentials(tokens);

    // Get user info
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });

    const email = profile.data.emailAddress;

    if (!email) {
      throw new Error("Failed to get email address");
    }

    // Check if account already exists for this user
    const existingAccount = await prisma.gmailAccount.findFirst({
      where: {
        userId: session.user.id,
        email,
      },
    });

    if (existingAccount) {
      // Update existing account tokens
      await prisma.gmailAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: encrypt(tokens.access_token),
          refreshToken: tokens.refresh_token
            ? encrypt(tokens.refresh_token)
            : existingAccount.refreshToken,
          tokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600000),
          syncStatus: "idle",
        },
      });

      logger.info("Gmail account tokens updated", {
        userId: session.user.id,
        accountId: existingAccount.id,
        email,
      });

      return NextResponse.redirect(
        new URL("/settings?success=account_updated", request.url)
      );
    }

    // Check if this is the first account
    const accountCount = await prisma.gmailAccount.count({
      where: { userId: session.user.id },
    });

    const isPrimary = accountCount === 0;

    // Encrypt tokens
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;

    // Save account to database
    const gmailAccount = await prisma.gmailAccount.create({
      data: {
        userId: session.user.id,
        email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : new Date(Date.now() + 3600000),
        syncStatus: "idle",
        isPrimary,
      },
    });

    logger.info("New Gmail account connected", {
      userId: session.user.id,
      accountId: gmailAccount.id,
      email,
      isPrimary,
    });

    // Set up Gmail push notifications
    try {
      await setupGmailWatch(gmailAccount.id);
    } catch (watchError) {
      logger.error("Failed to set up Gmail watch", { watchError });
    }

    // Redirect back to settings with success message
    return NextResponse.redirect(
      new URL("/settings?success=account_connected", request.url)
    );
  } catch (error) {
    logger.error("Failed to connect Gmail account", { error });
    return NextResponse.redirect(
      new URL(
        `/settings?error=${
          error instanceof Error ? error.message : "connection_failed"
        }`,
        request.url
      )
    );
  }
}
