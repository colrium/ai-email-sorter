/**
 * API Route: Set Primary Gmail Account
 * PATCH /api/accounts/[id]/set-primary
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: Request,
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

    // Use transaction to ensure only one primary account
    await prisma.$transaction(async (tx) => {
      // First, unset all primary flags for this user
      await tx.gmailAccount.updateMany({
        where: {
          userId: session.user.id,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });

      // Then set this account as primary
      await tx.gmailAccount.update({
        where: {
          id: accountId,
        },
        data: {
          isPrimary: true,
        },
      });
    });

    return NextResponse.json({
      message: "Primary account updated successfully",
    });
  } catch (error) {
    console.error("Failed to set primary account:", error);
    return NextResponse.json(
      { error: "Failed to set primary account" },
      { status: 500 }
    );
  }
}
