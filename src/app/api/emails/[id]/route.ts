import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db/prisma";

/**
 * GET /api/emails/[id] - Get a single email by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            icon: true,
          },
        },
        gmailAccount: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Verify email belongs to user's account
    if (email.gmailAccount.id) {
      const accountBelongsToUser = await prisma.gmailAccount.findFirst({
        where: {
          id: email.gmailAccount.id,
          userId: user.id,
        },
      });

      if (!accountBelongsToUser) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Serialize dates properly
    return NextResponse.json({
      ...email,
      date: email.date.toISOString(),
      createdAt: email.createdAt.toISOString(),
      updatedAt: email.updatedAt.toISOString(),
      processedAt: email.processedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Failed to fetch email:", error);
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/emails/[id] - Delete an email
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        gmailAccount: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Verify email belongs to user's account
    if (email.gmailAccount.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete email from database
    await prisma.email.delete({
      where: { id },
    });

    // Decrement category email count
    if (email.categoryId) {
      await prisma.category.update({
        where: { id: email.categoryId },
        data: { emailCount: { decrement: 1 } },
      });
    }

    return NextResponse.json({ message: "Email deleted successfully" });
  } catch (error) {
    console.error("Failed to delete email:", error);
    return NextResponse.json(
      { error: "Failed to delete email" },
      { status: 500 }
    );
  }
}
