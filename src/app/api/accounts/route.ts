/**
 * API Route: List Gmail Accounts
 * GET /api/accounts
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all Gmail accounts for this user
    const accounts = await prisma.gmailAccount.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        email: true,
        isPrimary: true,
        syncStatus: true,
        lastSyncedAt: true,
        _count: {
          select: {
            emails: true,
          },
        },
      },
      orderBy: [
        { isPrimary: "desc" }, // Primary account first
        { createdAt: "asc" }, // Then by creation date
      ],
    });

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        isPrimary: account.isPrimary,
        isActive:
          account.syncStatus === "active" || account.syncStatus === "syncing",
        syncStatus: account.syncStatus,
        lastSyncAt: account.lastSyncedAt,
        emailCount: account._count.emails,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
