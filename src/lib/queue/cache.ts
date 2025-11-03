/**
 * Redis Cache Utility
 * Provides caching functionality for frequently accessed data
 */

import { getRedisConnection } from "./connection";
import { logger } from "@/lib/utils/logger";

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get cached data
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisConnection();
    const cached = await redis.get(key);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as T;
  } catch (error) {
    logger.error("Failed to get cached data", { key, error });
    return null;
  }
}

/**
 * Set cached data
 */
export async function setCache(
  key: string,
  data: unknown,
  ttl: number = DEFAULT_TTL
): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    await redis.setex(key, ttl, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error("Failed to set cache", { key, error });
    return false;
  }
}

/**
 * Delete cached data
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error("Failed to delete cache", { key, error });
    return false;
  }
}

/**
 * Delete multiple cached keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    const redis = getRedisConnection();
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    logger.error("Failed to delete cache pattern", { pattern, error });
    return 0;
  }
}

/**
 * Cache with function execution
 * Gets cached value or executes function and caches result
 */
export async function cacheOrExecute<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  // Try to get from cache
  const cached = await getCached<T>(key);

  if (cached !== null) {
    logger.debug("Cache hit", { key });
    return cached;
  }

  logger.debug("Cache miss", { key });

  // Execute function
  const result = await fn();

  // Cache the result
  await setCache(key, result, ttl);

  return result;
}

/**
 * Generate cache key for user-specific data
 */
export function userCacheKey(userId: string, resource: string): string {
  return `user:${userId}:${resource}`;
}

/**
 * Generate cache key for email list
 */
export function emailListCacheKey(
  userId: string,
  categoryId?: string,
  page?: number,
  search?: string
): string {
  const parts = [`emails:${userId}`];

  if (categoryId) parts.push(`cat:${categoryId}`);
  if (page) parts.push(`page:${page}`);
  if (search) parts.push(`search:${search}`);

  return parts.join(":");
}

/**
 * Invalidate user caches
 */
export async function invalidateUserCaches(userId: string): Promise<void> {
  await deleteCachePattern(`user:${userId}:*`);
  await deleteCachePattern(`emails:${userId}:*`);
  logger.info("Invalidated user caches", { userId });
}
