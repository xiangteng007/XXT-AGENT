/**
 * error-handler.ts — 全局 Error Handler 中間件
 *
 * 設計原則（XXT v6.0 安全規範）：
 *   - 生產環境絕不暴露 stack trace
 *   - 所有錯誤統一格式：{ code, message, request_id }
 *   - 區分 4xx（用戶端錯誤）與 5xx（系統錯誤）
 *   - 5xx 必須寫入 logger（稽核追蹤）
 *   - request_id 從 X-Request-ID header 取得（或自動生成）
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

// ── 自定義 HTTP 錯誤類別 ────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

// 常用工廠方法
export const Errors = {
  badRequest:    (msg: string) => new HttpError(400, 'BAD_REQUEST',    msg),
  unauthorized:  (msg = '未授權存取') => new HttpError(401, 'UNAUTHORIZED', msg),
  forbidden:     (msg = '無存取權限') => new HttpError(403, 'FORBIDDEN', msg),
  notFound:      (msg = '資源不存在') => new HttpError(404, 'NOT_FOUND', msg),
  conflict:      (msg: string) => new HttpError(409, 'CONFLICT', msg),
  tooManyReqs:   (msg = '請求過於頻繁，請稍後再試') => new HttpError(429, 'RATE_LIMIT_EXCEEDED', msg),
  internal:      (msg = '伺服器內部錯誤') => new HttpError(500, 'INTERNAL_ERROR', msg),
  unavailable:   (msg = '服務暫時不可用') => new HttpError(503, 'SERVICE_UNAVAILABLE', msg),
} as const;

// ── 請求 ID 中間件（為每個請求附加追蹤 ID）────────────────────

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string)
    ?? `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

// ── 全局 Error Handler ─────────────────────────────────────────

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string ?? 'unknown';

  // ── 已知業務錯誤（HttpError）──────────────────────────────
  if (err instanceof HttpError) {
    // 4xx 只記 warn，5xx 記 error
    if (err.statusCode >= 500) {
      logger.error(`[${requestId}] ${err.statusCode} ${err.code}: ${err.message}`, {
        path:   req.path,
        method: req.method,
        ip:     req.ip,
      });
    } else {
      logger.warn(`[${requestId}] ${err.statusCode} ${err.code}: ${err.message}`);
    }

    res.status(err.statusCode).json({
      ok:         false,
      code:       err.code,
      message:    err.message,
      request_id: requestId,
    });
    return;
  }

  // ── 未知系統錯誤 ────────────────────────────────────────────
  logger.error(`[${requestId}] Unhandled error: ${err.message}`, {
    path:   req.path,
    method: req.method,
    ip:     req.ip,
    stack:  IS_PRODUCTION ? undefined : err.stack,
  });

  res.status(500).json({
    ok:         false,
    code:       'INTERNAL_ERROR',
    message:    IS_PRODUCTION ? '伺服器內部錯誤，請稍後再試' : err.message,
    request_id: requestId,
    stack:      IS_PRODUCTION ? undefined : err.stack,
  });
}

// ── 404 fallback handler ────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.headers['x-request-id'] as string ?? 'unknown';
  res.status(404).json({
    ok:         false,
    code:       'NOT_FOUND',
    message:    `找不到路由: ${req.method} ${req.path}`,
    request_id: requestId,
  });
}
