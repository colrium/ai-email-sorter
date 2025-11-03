import { z } from "zod";

// Category validation schemas
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Category name too long"),
  description: z.string().max(500, "Description too long").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Invalid color format")
    .optional(),
  icon: z.string().max(50).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  icon: z.string().max(50).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// Email validation schemas
export const emailFilterSchema = z.object({
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type EmailFilterInput = z.infer<typeof emailFilterSchema>;

// Gmail account validation
export const connectAccountSchema = z.object({
  isPrimary: z.boolean().default(false),
});

export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;
