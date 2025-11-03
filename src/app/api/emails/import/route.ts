import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db/prisma";
import { importEmails } from "@/lib/services/email-import-service";
import { z } from "zod";

const importSchema = z.object({
  accountId: z.string().uuid().optional(),
  maxResults: z.number().int().min(1).max(100).default(20),
  autoArchive: z.boolean().default(true),
  query: z.string().default("in:inbox"),
});

/**
 * POST /api/emails/import - Manually trigger email import
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        gmailAccounts: {
          orderBy: { isPrimary: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.gmailAccounts.length === 0) {
      return NextResponse.json(
        { error: "No Gmail accounts connected" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = importSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { accountId, maxResults, autoArchive, query } = validation.data;

    // Use provided accountId or default to primary account
    const targetAccountId = accountId || user.gmailAccounts[0].id;

    // Verify account belongs to user
    const account = user.gmailAccounts.find(
      (a: { id: string }) => a.id === targetAccountId
    );
    if (!account) {
      return NextResponse.json(
        { error: "Account not found or does not belong to user" },
        { status: 403 }
      );
    }

    // Check if user has categories
    const categoriesCount = await prisma.category.count({
      where: { userId: user.id },
    });

    if (categoriesCount === 0) {
      return NextResponse.json(
        {
          error:
            "No categories found. Please create at least one category before importing emails.",
        },
        { status: 400 }
      );
    }

    // Start import
    const result = await importEmails({
      accountId: targetAccountId,
      maxResults,
      autoArchive,
      query,
    });

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          error: "Import completed with errors",
          result,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      message: "Emails imported successfully",
      result,
    });
  } catch (error) {
    console.error("Email import failed:", error);
    return NextResponse.json(
      { error: "Failed to import emails", details: String(error) },
      { status: 500 }
    );
  }
}
