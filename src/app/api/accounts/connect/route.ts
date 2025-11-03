/**
 * API Route: Connect Additional Gmail Account
 * POST /api/accounts/connect
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { google } from "googleapis";
import { prisma } from "@/lib/db/prisma";
import { encrypt } from "@/lib/utils/encryption";
import { setupGmailWatch } from "@/lib/gmail/watch-service";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code required" },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/accounts/connect/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to get tokens");
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
      return NextResponse.json(
        { error: "This Gmail account is already connected" },
        { status: 400 }
      );
    }

    // Encrypt tokens
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

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
        syncStatus: "active",
      },
    });

    logger.info("New Gmail account connected", {
      userId: session.user.id,
      accountId: gmailAccount.id,
      email,
    });

    // Set up Gmail push notifications
    try {
      await setupGmailWatch(gmailAccount.id);
    } catch (watchError) {
      logger.error("Failed to set up Gmail watch", { watchError });
      // Don't fail the account connection if watch setup fails
    }

    return NextResponse.json({
      success: true,
      account: {
        id: gmailAccount.id,
        email: gmailAccount.email,
        isActive:
          gmailAccount.syncStatus === "active" ||
          gmailAccount.syncStatus === "syncing",
      },
    });
  } catch (error) {
    logger.error("Failed to connect Gmail account", { error });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect account",
      },
      { status: 500 }
    );
  }
}
