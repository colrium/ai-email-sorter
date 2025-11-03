/**
 * API Route: Delete Gmail Account
 * DELETE /api/accounts/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: accountId } = await params;

    // Verify account belongs to user
    const account = await prisma.gmailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Delete all emails for this account
    await prisma.email.deleteMany({
      where: {
        gmailAccountId: accountId,
      },
    });

    // Delete the account
    await prisma.gmailAccount.delete({
      where: {
        id: accountId,
      },
    });

    logger.info("Gmail account deleted", {
      userId: session.user.id,
      accountId,
      email: account.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete account", { error });
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
