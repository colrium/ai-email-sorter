/**
 * Unit tests for Redis Queue Connection
 */

import Redis from "ioredis";
import {
  getRedisConnection,
  closeRedisConnection,
  checkRedisHealth,
} from "@/lib/queue/connection";

// Mock ioredis
jest.mock("ioredis");

describe("Queue Connection", () => {
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Redis instance
    mockRedis = {
      status: "ready",
      ping: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);
  });

  afterEach(async () => {
    // Clean up singleton
    await closeRedisConnection();
  });

  describe("getRedisConnection", () => {
    it("should create a Redis connection", () => {
      const connection = getRedisConnection();

      expect(connection).toBeDefined();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        })
      );
    });

    it("should return the same connection on subsequent calls (singleton)", () => {
      const connection1 = getRedisConnection();
      const connection2 = getRedisConnection();

      expect(connection1).toBe(connection2);
      expect(Redis).toHaveBeenCalledTimes(1);
    });

    it("should set up event listeners", () => {
      getRedisConnection();

      expect(mockRedis.on).toHaveBeenCalledWith(
        "connect",
        expect.any(Function)
      );
      expect(mockRedis.on).toHaveBeenCalledWith("ready", expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith(
        "reconnecting",
        expect.any(Function)
      );
    });
  });

  describe("closeRedisConnection", () => {
    it("should close the connection if it exists", async () => {
      getRedisConnection();
      mockRedis.quit.mockResolvedValue("OK");

      await closeRedisConnection();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it("should not throw if no connection exists", async () => {
      await expect(closeRedisConnection()).resolves.not.toThrow();
    });

    it("should handle quit errors gracefully", async () => {
      getRedisConnection();
      mockRedis.quit.mockRejectedValue(new Error("Connection error"));

      await expect(closeRedisConnection()).resolves.not.toThrow();
    });
  });

  describe("checkRedisHealth", () => {
    it("should return healthy status when Redis is connected", async () => {
      getRedisConnection();
      mockRedis.ping.mockResolvedValue("PONG");
      mockRedis.status = "ready";

      const health = await checkRedisHealth();

      expect(health).toEqual({
        healthy: true,
        status: "ready",
        message: "Redis connection is healthy",
      });
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it("should return unhealthy status when ping fails", async () => {
      getRedisConnection();
      mockRedis.ping.mockRejectedValue(new Error("Connection timeout"));
      mockRedis.status = "connecting";

      const health = await checkRedisHealth();

      expect(health).toEqual({
        healthy: false,
        status: "connecting",
        message: "Connection timeout",
      });
    });

    it("should return unhealthy when no connection exists", async () => {
      const health = await checkRedisHealth();

      expect(health).toEqual({
        healthy: false,
        status: "disconnected",
        message: "No Redis connection",
      });
    });

    it("should handle various Redis statuses", async () => {
      getRedisConnection();
      mockRedis.ping.mockResolvedValue("PONG");

      // Test different statuses
      const statuses = [
        "connecting",
        "connect",
        "ready",
        "reconnecting",
        "close",
        "end",
      ] as const;

      for (const status of statuses) {
        mockRedis.status = status;
        const health = await checkRedisHealth();

        if (status === "ready") {
          expect(health.healthy).toBe(true);
        } else {
          expect(health.status).toBe(status);
        }
      }
    });
  });
});
