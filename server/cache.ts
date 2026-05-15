import Redis from "ioredis";

// Initialize Redis client for caching
let redis: Redis | null = null;
let redisConnected = false;

// Debug mode - set DEBUG_CACHE=true in .env to see cache logs
const DEBUG_CACHE = process.env.DEBUG_CACHE === 'true';

// In-memory fallback cache for when Redis is unavailable
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

const initRedis = () => {
  if (redis) return redis;
  
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    if (DEBUG_CACHE) console.log('⚠️ REDIS_URL not configured. Using in-memory fallback cache.');
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy(times) {
        // Don't retry if Redis isn't properly configured
        if (times > 3) {
          redisConnected = false;
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      reconnectOnError(err) {
        if (err.message.includes('READONLY')) {
          return true;
        }
        return false;
      },
      // Suppress connection errors - we have fallback cache
      lazyConnect: true,
    });

    redis.on('connect', () => {
      redisConnected = true;
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
      redisConnected = false;
      if (DEBUG_CACHE) console.error('❌ Redis error (using fallback cache):', err.message);
    });

    redis.on('close', () => {
      redisConnected = false;
      if (DEBUG_CACHE) console.log('⚠️ Redis connection closed (using fallback cache)');
    });

    // Only connect if explicitly requested
    redis.connect().catch(err => {
      if (DEBUG_CACHE) console.warn('⚠️ Redis connection failed, using fallback cache:', err.message);
      redisConnected = false;
    });

    return redis;
  } catch (err) {
    console.error('❌ Failed to initialize Redis:', err);
    return null;
  }
};

// Initialize Redis on module load
initRedis();

// Clean up expired memory cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}, 60000); // Every minute

export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try memory cache first (always available)
  const now = Date.now();
  const memEntry = memoryCache.get(key);
  if (memEntry && memEntry.expiresAt > now) {
    if (DEBUG_CACHE) console.log(`✓ Memory cache HIT for key: ${key}`);
    return memEntry.value as T;
  }
  
  // Remove expired entry
  if (memEntry && memEntry.expiresAt <= now) {
    memoryCache.delete(key);
  }

  // Try Redis if available
  if (!redis || !redisConnected) {
    if (DEBUG_CACHE) console.log(`⚠️ Redis unavailable, memory cache ${memEntry ? 'expired' : 'miss'} for key: ${key}`);
    return null;
  }

  try {
    const data = await redis.get(key);
    if (!data) return null;
    
    // Also store in memory cache as backup
    const parsed = JSON.parse(data) as T;
    return parsed;
  } catch (err) {
    console.error(`❌ Cache GET error for key ${key}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds = 60): Promise<void> {
  const expiresAt = Date.now() + (ttlSeconds * 1000);
  
  // Always save to memory cache as fallback
  memoryCache.set(key, { value, expiresAt });
  if (DEBUG_CACHE) console.log(`✓ Cached in memory (TTL: ${ttlSeconds}s): ${key}`);

  // Try to save to Redis if available
  if (!redis || !redisConnected) {
    if (DEBUG_CACHE) console.log(`⚠️ Redis unavailable, using memory-only cache for: ${key}`);
    return;
  }

  try {
    const stringValue = JSON.stringify(value);
    await redis.set(key, stringValue, "EX", ttlSeconds);
    if (DEBUG_CACHE) console.log(`✓ Cached in Redis (TTL: ${ttlSeconds}s): ${key}`);
  } catch (err) {
    console.error(`❌ Cache SET error for key ${key}:`, err instanceof Error ? err.message : err);
    // Fallback to memory is already done above
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    if (!redisConnected) {
      console.warn(`⚠️ Redis not connected, cannot delete key: ${key}`);
      return;
    }

    await redis.del(key);
  } catch (err) {
    console.error(`❌ Cache DELETE error for key ${key}:`, err instanceof Error ? err.message : err);
  }
}

export async function cacheDelPattern(prefix: string): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    if (!redisConnected) {
      console.warn(`⚠️ Redis not connected, cannot delete pattern: ${prefix}`);
      return;
    }

    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error(`❌ Cache DELETE PATTERN error for prefix ${prefix}:`, err instanceof Error ? err.message : err);
  }
}

// Export Redis status for monitoring
export function getRedisStatus() {
  return {
    connected: redisConnected,
    available: redis !== null,
    url: process.env.REDIS_URL ? 'configured' : 'not configured'
  };
}