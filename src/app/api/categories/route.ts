import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db/prisma";
import { createCategorySchema } from "@/lib/utils/validation";
import { logger } from "@/lib/utils/logger";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/constants/colors";

// GET /api/categories - List all categories for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await prisma.category.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        icon: true,
        emailCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    logger.error("Failed to fetch categories", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createCategorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name, description, color, icon } = validationResult.data;

    // Check if category with same name already exists
    const existing = await prisma.category.findFirst({
      where: {
        userId: session.user.id,
        name: name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        color: color || DEFAULT_CATEGORY_COLOR,
        icon: icon || "category",
      },
    });

    logger.info("Category created", {
      categoryId: category.id,
      userId: session.user.id,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    logger.error("Failed to create category", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
