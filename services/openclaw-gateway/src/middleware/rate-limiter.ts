/**
 * rate-limiter.ts — API 速率限制中間件
 *
 * v6.0 安全規範：
 *   - 不依賴外部 Redis（本地 in-memory，單容器適用）
 *   - 支援多層級限制：全局 / Agent 路由 / 敏感財務路由
 *   - 滑動視窗演算法（Sliding Window）
 *   - 逾限時返回標準 429 格式（含 Retry-After header）
 *   - IP 來源從 X-Forwarded-For 取得（考慮 Cloud Run 代理層）
 *
 * 限制設計（v6.0）：
 *   GLOBAL_LIMIT:    每 IP，60 req/min（防 DoS）
 *   AGENT_LIMIT:     每 IP，20 req/min（Agent API 防刷）
 *   FINANCE_LIMIT:   每 IP，10 req/min（財務 API 強保護）
 *   OLLAMA_LIMIT:    每 IP，5 req/min（Ollama 推理防爆量）
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

// ── 滑動視窗計數器 ──────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[];  // 請求時間戳記（毫秒）
}

class SlidingWindowRateLimiter {
  private readonly store = new Map<string, WindowEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly windowMs:   number,   // 視窗大小（毫秒）
    private readonly maxRequests: number,  // 視窗內最大請求數
    private readonly name:        string,  // 限制器名稱（log 用）
  ) {
    // 每 5 分鐘清理過期 key，防止記憶體洩漏
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref(); // 不阻止 Node.js 結束
  }

  /** 嘗試消耗一個請求配額，回傳 { allowed, remaining, resetAt } */
  consume(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // 移除視窗外的過期時間戳
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    const count = entry.timestamps.length;
    const allowed = count < this.maxRequests;

    if (allowed) {
      entry.timestamps.push(now);
    }

    const remaining = Math.max(0, this.maxRequests - entry.timestamps.length);
    const resetAt   = entry.timestamps[0] ? entry.timestamps[0] + this.windowMs : now + this.windowMs;

    return { allowed, remaining, resetAt };
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleaned = 0;
    for (const [key, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`[RateLimit:${this.name}] Cleaned ${cleaned} expired keys`);
    }
  }

  /** 回傳目前活躍 key 數量（監控用）*/
  getActiveKeys(): number {
    return this.store.size;
  }
}

// ── 實體化各層級 Limiter ────────────────────────────────────────

const LIMITERS = {
  global:  new SlidingWindowRateLimiter(60_000,  60, 'global'),   // 60 req/min
  agent:   new SlidingWindowRateLimiter(60_000,  20, 'agent'),    // 20 req/min
  finance: new SlidingWindowRateLimiter(60_000,  10, 'finance'),  // 10 req/min
  ollama:  new SlidingWindowRateLimiter(60_000,   5, 'ollama'),   //  5 req/min
} as const;

// ── IP 擷取工具 ─────────────────────────────────────────────────

function getClientIp(req: Request): string {
  // Cloud Run / nginx proxy 會設定 X-Forwarded-For
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return (ip ?? req.ip ?? 'unknown').trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// ── 中間件工廠 ─────────────────────────────────────────────────

function createRateLimitMiddleware(
  limiterKey: keyof typeof LIMITERS,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // ── Skip rate limiting in test environment ──────────────
    if (process.env['NODE_ENV'] === 'test') {
      next();
      return;
    }

    const ip = getClientIp(req);
    const { allowed, remaining, resetAt } = LIMITERS[limiterKey].consume(ip);

    // 設定標準 Rate Limit headers（RFC 6585）
    res.setHeader('X-RateLimit-Limit',     String(LIMITERS[limiterKey]['maxRequests']));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset',     String(Math.ceil(resetAt / 1000)));

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));

      logger.warn(`[RateLimit:${limiterKey}] IP ${ip} exceeded limit on ${req.path}`);

      res.status(429).json({
        ok:          false,
        code:        'RATE_LIMIT_EXCEEDED',
        message:     '請求過於頻繁，請稍後再試',
        retry_after: retryAfter,
        request_id:  req.headers['x-request-id'] ?? 'unknown',
      });
      return;
    }

    next();
  };
}

// ── 匯出各層級限制器 ────────────────────────────────────────────

/** 全局速率限制（每 IP 60 req/min）— 應用於所有路由 */
export const globalRateLimit = createRateLimitMiddleware('global');

/** Agent API 速率限制（每 IP 20 req/min）— 應用於 /agents/* */
export const agentRateLimit = createRateLimitMiddleware('agent');

/** 財務 API 速率限制（每 IP 10 req/min）— 應用於 accountant / finance / guardian */
export const financeRateLimit = createRateLimitMiddleware('finance');

/** Ollama 推理速率限制（每 IP 5 req/min）— 應用於 /chat 端點 */
export const ollamaRateLimit = createRateLimitMiddleware('ollama');

/** 取得所有 Limiter 指標（監控 API 用）*/
export function getRateLimitStats(): Record<string, number> {
  return Object.fromEntries(
    Object.entries(LIMITERS).map(([k, limiter]) => [k, limiter.getActiveKeys()]),
  );
}
