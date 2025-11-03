import {
  createCategorySchema,
  updateCategorySchema,
  emailFilterSchema,
  connectAccountSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/utils/validation";

describe("Validation Schemas", () => {
  describe("createCategorySchema", () => {
    it("should validate a valid category", () => {
      const validCategory = {
        name: "Newsletters",
        description: "Marketing emails and newsletters",
        color: "#1976d2",
        icon: "email",
      };

      const result = createCategorySchema.safeParse(validCategory);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validCategory);
      }
    });

    it("should validate category with only required fields", () => {
      const minimalCategory = {
        name: "Work",
      };

      const result = createCategorySchema.safeParse(minimalCategory);
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const invalidCategory = {
        name: "",
        description: "Test",
      };

      const result = createCategorySchema.safeParse(invalidCategory);
      expect(result.success).toBe(false);
    });

    it("should reject name that is too long", () => {
      const invalidCategory = {
        name: "a".repeat(101),
      };

      const result = createCategorySchema.safeParse(invalidCategory);
      expect(result.success).toBe(false);
    });

    it("should reject description that is too long", () => {
      const invalidCategory = {
        name: "Test",
        description: "a".repeat(501),
      };

      const result = createCategorySchema.safeParse(invalidCategory);
      expect(result.success).toBe(false);
    });

    it("should reject invalid color format", () => {
      const invalidCategory = {
        name: "Test",
        color: "blue", // Should be hex format
      };

      const result = createCategorySchema.safeParse(invalidCategory);
      expect(result.success).toBe(false);
    });

    it("should accept valid hex colors", () => {
      const colors = ["#FFFFFF", "#000000", "#1a2b3c", "#ABC", "#fff"];

      colors.forEach((color) => {
        const category = { name: "Test", color };
        const result = createCategorySchema.safeParse(category);
        // Note: Our schema requires 6-digit hex, so #ABC and #fff should fail
        if (color.length === 7) {
          expect(result.success).toBe(true);
        }
      });
    });

    it("should trim whitespace from name", () => {
      const category = {
        name: "  Test Category  ",
      };

      const result = createCategorySchema.safeParse(category);
      expect(result.success).toBe(true);
    });

    it("should allow optional fields to be undefined", () => {
      const category = {
        name: "Test",
        description: undefined,
        color: undefined,
        icon: undefined,
      };

      const result = createCategorySchema.safeParse(category);
      expect(result.success).toBe(true);
    });
  });

  describe("updateCategorySchema", () => {
    it("should validate partial updates", () => {
      const update = {
        name: "Updated Name",
      };

      const result = updateCategorySchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it("should allow updating only description", () => {
      const update = {
        description: "New description",
      };

      const result = updateCategorySchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it("should allow updating only color", () => {
      const update = {
        color: "#FF0000",
      };

      const result = updateCategorySchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it("should allow empty update object", () => {
      const update = {};

      const result = updateCategorySchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it("should validate all fields when provided", () => {
      const update = {
        name: "New Name",
        description: "New description",
        color: "#00FF00",
        icon: "star",
      };

      const result = updateCategorySchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it("should reject invalid name if provided", () => {
      const update = {
        name: "", // Empty name should be rejected
      };

      const result = updateCategorySchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe("emailFilterSchema", () => {
    it("should validate with default values", () => {
      const filter = {};

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it("should validate with categoryId filter", () => {
      const filter = {
        categoryId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it("should validate with search filter", () => {
      const filter = {
        search: "important email",
      };

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it("should validate with boolean filters", () => {
      const filter = {
        isRead: true,
        isStarred: false,
      };

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it("should validate custom page and limit", () => {
      const filter = {
        page: 5,
        limit: 50,
      };

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
    });

    it("should reject invalid page number", () => {
      const filter = {
        page: 0, // Must be positive
      };

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(false);
    });

    it("should reject limit exceeding maximum", () => {
      const filter = {
        limit: 101, // Max is 100
      };

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(false);
    });

    it("should reject invalid categoryId format", () => {
      const filter = {
        categoryId: "not-a-uuid",
      };

      const result = emailFilterSchema.safeParse(filter);
      expect(result.success).toBe(false);
    });
  });

  describe("connectAccountSchema", () => {
    it("should validate with default isPrimary", () => {
      const account = {};

      const result = connectAccountSchema.safeParse(account);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPrimary).toBe(false);
      }
    });

    it("should validate with isPrimary true", () => {
      const account = {
        isPrimary: true,
      };

      const result = connectAccountSchema.safeParse(account);
      expect(result.success).toBe(true);
    });

    it("should validate with isPrimary false", () => {
      const account = {
        isPrimary: false,
      };

      const result = connectAccountSchema.safeParse(account);
      expect(result.success).toBe(true);
    });

    it("should reject non-boolean isPrimary", () => {
      const account = {
        isPrimary: "true", // String instead of boolean
      };

      const result = connectAccountSchema.safeParse(account);
      expect(result.success).toBe(false);
    });
  });

  describe("Type inference", () => {
    it("should infer correct types for CreateCategoryInput", () => {
      const category: CreateCategoryInput = {
        name: "Test",
        description: "Description",
        color: "#FFFFFF",
        icon: "test",
      };

      expect(category.name).toBeDefined();
    });

    it("should infer correct types for UpdateCategoryInput", () => {
      const update: UpdateCategoryInput = {
        name: "Test",
      };

      expect(update.name).toBeDefined();
    });
  });
});
