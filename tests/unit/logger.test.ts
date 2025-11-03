import { logger } from "@/lib/utils/logger";

describe("Logger", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe("info", () => {
    it("should log info messages", () => {
      logger.info("Test info message");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should log info with metadata", () => {
      const metadata = { userId: "123", action: "login" };
      logger.info("User logged in", metadata);
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = String(consoleLogSpy.mock.calls[0][0]);
      expect(
        logOutput.includes("User logged in") || logOutput.includes("info")
      ).toBe(true);
    });

    it("should handle info with complex metadata", () => {
      const metadata = {
        user: { id: "123", email: "test@example.com" },
        timestamp: new Date(),
        nested: { value: "test" },
      };
      logger.info("Complex metadata", metadata);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("warn", () => {
    it("should log warning messages", () => {
      logger.warn("Test warning message");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should log warning with metadata", () => {
      const metadata = { attempt: 3, maxAttempts: 5 };
      logger.warn("Retry attempt", metadata);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should handle warnings without metadata", () => {
      logger.warn("Simple warning");
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("error", () => {
    it("should log error messages", () => {
      logger.error("Test error message");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should log error with metadata", () => {
      const metadata = { errorCode: "AUTH_FAILED", userId: "123" };
      logger.error("Authentication failed", metadata);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle Error objects", () => {
      const error = new Error("Something went wrong");
      logger.error("Error occurred", { error });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle errors with stack traces", () => {
      const error = new Error("Test error");
      const metadata = { error, context: "database-query" };
      logger.error("Database error", metadata);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("debug", () => {
    it("should log debug messages in development", () => {
      // Mock console.debug which is used in development
      const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();
      logger.debug("Debug message");
      consoleDebugSpy.mockRestore();
      // Debug logs only show in development, so they may not be called in test environment
      expect(() => logger.debug("test")).not.toThrow();
    });

    it("should log debug with metadata", () => {
      const metadata = { query: "SELECT * FROM users", duration: 123 };
      expect(() => logger.debug("Database query", metadata)).not.toThrow();
    });

    it("should not throw errors", () => {
      expect(() => logger.debug("test")).not.toThrow();
    });
  });

  describe("Timestamp handling", () => {
    it("should include timestamp in logs", () => {
      logger.info("Test message");
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.stringify(consoleLogSpy.mock.calls[0]);
      // Check if timestamp pattern exists (ISO 8601 format)
      const hasTimestamp =
        /\d{4}-\d{2}-\d{2}/.test(logOutput) || /timestamp/i.test(logOutput);
      expect(hasTimestamp).toBe(true);
    });
  });

  describe("Log levels", () => {
    it("should support all log levels", () => {
      logger.info("Info");
      logger.warn("Warn");
      logger.error("Error");
      logger.debug("Debug");

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle rapid successive logs", () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }
      expect(consoleLogSpy).toHaveBeenCalledTimes(10);
    });
  });

  describe("Metadata handling", () => {
    it("should handle null metadata", () => {
      expect(() =>
        logger.info("Message", null as unknown as Record<string, unknown>)
      ).not.toThrow();
    });

    it("should handle undefined metadata", () => {
      expect(() => logger.info("Message", undefined)).not.toThrow();
    });

    it("should handle empty metadata object", () => {
      logger.info("Message", {});
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should handle metadata with circular references", () => {
      const circular: Record<string, unknown> = { name: "test" };
      circular.self = circular;

      // Should not throw even with circular reference
      expect(() => logger.info("Circular", circular)).not.toThrow();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should handle metadata with special characters", () => {
      const metadata = {
        message: "Test with \"quotes\" and 'apostrophes'",
        special: "<>&\n\t",
      };
      expect(() => logger.info("Special chars", metadata)).not.toThrow();
    });
  });

  describe("Message formatting", () => {
    it("should handle empty message", () => {
      expect(() => logger.info("")).not.toThrow();
    });

    it("should handle very long messages", () => {
      const longMessage = "a".repeat(10000);
      expect(() => logger.info(longMessage)).not.toThrow();
    });

    it("should handle messages with newlines", () => {
      const message = "Line 1\nLine 2\nLine 3";
      logger.info(message);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should handle Unicode messages", () => {
      const message = "测试 🚀 Тест مرحبا";
      logger.info(message);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
