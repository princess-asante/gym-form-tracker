import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const STREAM_LIFETIME_MAX = 36;
const STREAM_LIFETIME_TTL = 48 * 60 * 60; // 48 hours in seconds

export async function checkLifetimeLimit(sessionId: string): Promise<{ allowed: boolean; count: number }> {
  const key = `stream:lifetime:${sessionId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, STREAM_LIFETIME_TTL);
  }
  return { allowed: count <= STREAM_LIFETIME_MAX, count };
}

export const streamLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(3, "5 s", 3),
  prefix: "ratelimit:stream",
  analytics: true,
});

export const photoLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "ratelimit:photo",
  analytics: true,
});

export const videoLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:video",
  analytics: true,
});

export const blobLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:blob",
  analytics: true,
});
