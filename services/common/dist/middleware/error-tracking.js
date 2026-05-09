"use strict";
/**
 * Unified Error Tracking Middleware for Cloud Run Services
 *
 * Provides structured error logging compatible with Cloud Logging
 * and optional Sentry integration for all microservices.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorHandler = createErrorHandler;
exports.createRequestLogger = createRequestLogger;
exports.createHealthCheck = createHealthCheck;
/**
 * Creates an error handling middleware for a given service
 */
function createErrorHandler(serviceName) {
    return (err, req, res, _next) => {
        const statusCode = err.statusCode || 500;
        const isCritical = statusCode >= 500;
        const errorLog = {
            severity: isCritical ? 'CRITICAL' : 'WARNING',
            service: serviceName,
            message: err.message,
            stack: isCritical ? err.stack : undefined,
            path: req.path,
            method: req.method,
            statusCode,
            timestamp: new Date().toISOString(),
            traceId: req.headers['x-cloud-trace-context'],
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
function createRequestLogger(serviceName) {
    return (req, _res, next) => {
        console.log(JSON.stringify({
            severity: 'INFO',
            service: serviceName,
            message: `${req.method} ${req.path}`,
            timestamp: new Date().toISOString(),
            traceId: req.headers['x-cloud-trace-context'],
        }));
        next();
    };
}
/**
 * Health check endpoint factory
 */
function createHealthCheck(serviceName, dependencies = {}) {
    return (_req, res) => {
        const allHealthy = Object.values(dependencies).every(Boolean);
        res.status(allHealthy ? 200 : 503).json({
            status: allHealthy ? 'healthy' : 'degraded',
            service: serviceName,
            dependencies,
            timestamp: new Date().toISOString(),
        });
    };
}
