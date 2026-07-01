import Redis from "ioredis";

let client: Redis | null = null;
let connectionFailed = false;

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const instance = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  instance.on("error", (err: Error) => {
    if (!connectionFailed) {
      console.warn("[redis] connection error — falling back to in-memory stores:", err.message);
    }
    connectionFailed = true;
  });

  instance.on("connect", () => {
    connectionFailed = false;
    console.log("[redis] connected");
  });

  return instance;
}

export function getRedis(): Redis | null {
  if (connectionFailed) return null;
  if (!client) {
    client = createRedisClient();
    if (client) {
      client.connect().catch(() => {
        connectionFailed = true;
        client = null;
      });
    }
  }
  return connectionFailed ? null : client;
}

export async function redisGet(key: string): Promise<string | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    if (ttlSeconds) {
      await r.set(key, value, "EX", ttlSeconds);
    } else {
      await r.set(key, value);
    }
  } catch {}
}

export async function redisDel(...keys: string[]): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.del(...keys);
  } catch {}
}

export async function redisIncr(key: string): Promise<number | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    return await r.incr(key);
  } catch {
    return null;
  }
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.expire(key, ttlSeconds);
  } catch {}
}

export async function redisTTL(key: string): Promise<number> {
  try {
    const r = getRedis();
    if (!r) return -2;
    return await r.ttl(key);
  } catch {
    return -2;
  }
}

export const isRedisAvailable = () => !!getRedis() && !connectionFailed;
