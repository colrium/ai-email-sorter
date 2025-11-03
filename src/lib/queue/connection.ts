/**
 * Redis Connection Manager for BullMQ
 * Provides singleton connection instance with automatic reconnection
 */

import Redis from "ioredis";
import { logger } from "@/lib/utils/logger";

// Redis connection configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false, // Required for BullMQ
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

let redisConnection: Redis | null = null;

/**
 * Get or create Redis connection instance
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    logger.info("Creating new Redis connection", REDIS_CONFIG);

    redisConnection = new Redis(REDIS_CONFIG);

    redisConnection.on("connect", () => {
      logger.info("Redis connection established");
    });

    redisConnection.on("ready", () => {
      logger.info("Redis connection ready");
    });

    redisConnection.on("error", (error) => {
      logger.error("Redis connection error", { error: error.message });
    });

    redisConnection.on("close", () => {
      logger.warn("Redis connection closed");
    });

    redisConnection.on("reconnecting", () => {
      logger.info("Redis reconnecting...");
    });
  }

  return redisConnection;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    logger.info("Closing Redis connection");
    try {
      await redisConnection.quit();
    } catch (error) {
      // Ignore quit errors
      logger.warn("Error during Redis quit", { error });
    }
    redisConnection = null;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  status: string;
  message: string;
}> {
  if (!redisConnection) {
    return {
      healthy: false,
      status: "disconnected",
      message: "No Redis connection",
    };
  }

  try {
    await redisConnection.ping();
    const status = redisConnection.status || "unknown";
    return {
      healthy: status === "ready",
      status,
      message:
        status === "ready"
          ? "Redis connection is healthy"
          : `Redis status: ${status}`,
    };
  } catch (error) {
    return {
      healthy: false,
      status: redisConnection.status || "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
