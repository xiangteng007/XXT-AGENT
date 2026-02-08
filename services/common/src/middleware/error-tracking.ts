/**
 * Unified Error Tracking Middleware for Cloud Run Services
 * 
 * Provides structured error logging compatible with Cloud Logging
 * and optional Sentry integration for all microservices.
 */

import { Request, Response, NextFunction } from 'express';

interface ErrorLog {
    severity: 'ERROR' | 'WARNING' | 'CRITICAL';
    service: string;
    message: string;
    stack?: string;
    path?: string;
    method?: string;
    statusCode?: number;
    timestamp: string;
    traceId?: string;
}

/**
 * Creates an error handling middleware for a given service
 */
export function createErrorHandler(serviceName: string) {
    return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
        const statusCode = (err as { statusCode?: number }).statusCode || 500;
        const isCritical = statusCode >= 500;

        const errorLog: ErrorLog = {
            severity: isCritical ? 'CRITICAL' : 'WARNING',
            service: serviceName,
            message: err.message,
            stack: isCritical ? err.stack : undefined,
            path: req.path,
            method: req.method,
            statusCode,
            timestamp: new Date().toISOString(),
            traceId: req.headers['x-cloud-trace-context'] as string,
        };

        // Structured logging for Cloud Logging
        console.error(JSON.stringify(errorLog));

        res.status(statusCode).json({
            error: isCritical ? 'Internal server error' : err.message,
            service: serviceName,
            traceId: errorLog.traceId,
        });
    };
}

/**
 * Request logging middleware with trace context
 */
export function createRequestLogger(serviceName: string) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        console.log(JSON.stringify({
            severity: 'INFO',
            service: serviceName,
            message: `${req.method} ${req.path}`,
            timestamp: new Date().toISOString(),
            traceId: req.headers['x-cloud-trace-context'] as string,
        }));
        next();
    };
}

/**
 * Health check endpoint factory
 */
export function createHealthCheck(serviceName: string, dependencies: Record<string, boolean> = {}) {
    return (_req: Request, res: Response): void => {
        const allHealthy = Object.values(dependencies).every(Boolean);
        res.status(allHealthy ? 200 : 503).json({
            status: allHealthy ? 'healthy' : 'degraded',
            service: serviceName,
            dependencies,
            timestamp: new Date().toISOString(),
        });
    };
}
