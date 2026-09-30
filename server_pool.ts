/**
 * Server-Side Connection Pooling and Polling Cache Layer for COMOS
 * 
 * Prevents "User has exceeded the 'max_connections_per_hour' resource" errors from database providers
 * by:
 * 1. Maintaining a strictly capped, persistent MySQL connection pool that reuses TCP connections.
 * 2. Keeping pool connections alive with proactive TCP keep-alive and lightweight ping intervals.
 * 3. Caching high-frequency live-polling endpoints in memory with short TTLs and instant cache
 *    invalidation on database mutations.
 * 4. Circuit breaker that backs off connection attempts when max_connections_per_hour limit is reported.
 */

import mysql from 'mysql2/promise';

export interface PoolConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  ssl?: any;
}

export interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

/**
 * High-performance In-Memory Polling Cache with Domain-Aware Invalidation
 */
export class PollingCacheManager {
  private cache = new Map<string, CacheEntry>();

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  public set<T>(key: string, data: T, ttlMs: number = 15000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public invalidatePattern(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateDomain(domain: string): void {
    const d = domain.toLowerCase();
    if (d.includes('sms')) {
      this.invalidatePattern(/^sms:/);
    }
    if (d.includes('device') || d.includes('user')) {
      this.invalidatePattern(/^device:/);
    }
    if (d.includes('cert') || d.includes('file')) {
      this.invalidatePattern(/^cert:/);
    }
    if (d.includes('vessel')) {
      this.invalidatePattern(/^vessel:/);
      this.invalidatePattern(/^sms:/);
      this.invalidatePattern(/^cert:/);
    }
    if (d.includes('db') || d.includes('status')) {
      this.invalidatePattern(/^db:/);
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const pollingCache = new PollingCacheManager();

/**
 * Detects MySQL rate limit or resource limit exhaustion
 */
export function isRateLimitError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'ER_USER_LIMIT_REACHED' ||
    code === '1226' ||
    msg.includes('max_connections_per_hour') ||
    msg.includes('max_user_connections') ||
    msg.includes('max_queries_per_hour') ||
    msg.includes('max_updates_per_hour') ||
    msg.includes("exceeded the 'max_connections_per_hour' resource")
  );
}

/**
 * Circuit breaker state for database connection rate limits
 */
export class RateLimitCircuitBreaker {
  private inCooldown = false;
  private cooldownUntil = 0;
  private lastErrorMessage = '';

  public isCoolingDown(): boolean {
    if (!this.inCooldown) return false;
    if (Date.now() >= this.cooldownUntil) {
      this.inCooldown = false;
      this.lastErrorMessage = '';
      return false;
    }
    return true;
  }

  public triggerCooldown(message: string, durationMs: number = 60000): void {
    this.inCooldown = true;
    this.cooldownUntil = Date.now() + durationMs;
    this.lastErrorMessage = message;
    console.warn(`[MySQL CircuitBreaker] Database provider connection rate-limit hit: "${message}". Entering ${durationMs / 1000}s cooldown.`);
  }

  public getErrorMessage(): string {
    return this.lastErrorMessage || 'Database connection rate-limit cooldown active';
  }

  public getRemainingCooldownSec(): number {
    if (!this.inCooldown) return 0;
    return Math.max(0, Math.ceil((this.cooldownUntil - Date.now()) / 1000));
  }

  public reset(): void {
    this.inCooldown = false;
    this.cooldownUntil = 0;
    this.lastErrorMessage = '';
  }
}

export const dbRateLimitBreaker = new RateLimitCircuitBreaker();

/**
 * Creates and configures an optimal MySQL connection pool for shared hosting / provider limits
 */
export function createOptimizedPool(config: PoolConfig): mysql.Pool {
  const pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port,
    waitForConnections: true,
    // Keep max connections strictly capped (3 to 4 connections is ideal for shared hosts like Hostinger)
    connectionLimit: 4,
    // Keep idle connections ready in pool to prevent reconnect handshakes
    maxIdle: 4,
    // Long idle timeout (1 hour) so pool connections stay open and are reused for all polling
    idleTimeout: 3600000,
    // Enable OS TCP keep-alive probes
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Queue queries safely during polling bursts
    queueLimit: 1000,
    connectTimeout: 10000,
    ssl: config.ssl,
  });

  return pool;
}

let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Starts a proactive keepalive heartbeat to prevent remote firewalls / wait_timeout from severing idle connections
 */
export function startPoolHeartbeat(pool: mysql.Pool): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    try {
      if (dbRateLimitBreaker.isCoolingDown()) {
        return; // Do not send pings while backing off
      }
      if (pool) {
        await pool.query('SELECT 1');
      }
    } catch (err: any) {
      if (isRateLimitError(err)) {
        dbRateLimitBreaker.triggerCooldown(err.message || 'Exceeded max_connections_per_hour', 60000);
      }
      // Silently catch other transient errors; pool handles reconnect on demand
    }
  }, 45000).unref();
}
