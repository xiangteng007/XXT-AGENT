"use strict";
/**
 * Unified Error Reporting Middleware for Cloud Run Microservices
 *
 * Provides structured error logging compatible with Google Cloud Error Reporting
 * and optional Sentry integration for the XXT-AGENT microservice fleet.
 *
 * Usage:
 *   import { errorMiddleware, initErrorReporting } from '@xxt-agent/common/error-reporting';
 *
 *   // Initialize (call once at service startup)
 *   initErrorReporting({ serviceName: 'ai-gateway' });
 *
 *   // Apply middleware (after all routes)
 *   app.use(errorMiddleware);
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initErrorReporting = initErrorReporting;
exports.errorMiddleware = errorMiddleware;
let config = {
    serviceName: 'unknown-service',
};
let sentryModule = null;
/**
 * Initialize error reporting for a Cloud Run service.
 * Call this once during service startup.
 */
async function initErrorReporting(options) {
    config = {
        ...options,
        projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'xxt-agent',
    };
    // Try to initialize Sentry if DSN is provided
    if (options.sentryDsn || process.env.SENTRY_DSN) {
        try {
            sentryModule = await Promise.resolve().then(() => __importStar(require('@sentry/node')));
            sentryModule.init({
                dsn: options.sentryDsn || process.env.SENTRY_DSN,
                environment: process.env.NODE_ENV || 'production',
                release: process.env.GIT_COMMIT || 'unknown',
                serverName: config.serviceName,
            });
            console.log(JSON.stringify({
                severity: 'INFO',
                message: `Sentry initialized for ${config.serviceName}`,
            }));
        }
        catch (e) {
            console.log(JSON.stringify({
                severity: 'WARNING',
                message: `Sentry not available for ${config.serviceName} (optional)`,
                error: String(e),
            }));
        }
    }
    console.log(JSON.stringify({
        severity: 'INFO',
        message: `Error reporting initialized for ${config.serviceName}`,
    }));
}
/**
 * Express error handling middleware.
 * Logs errors in Cloud Logging structured format and reports to Sentry if configured.
 */
function errorMiddleware(err, req, res, _next) {
    // Structured log for Cloud Error Reporting
    const errorLog = {
        severity: 'ERROR',
        message: err.message,
        stack: err.stack,
        httpRequest: {
            method: req.method,
            url: req.originalUrl,
            userAgent: req.headers['user-agent'],
            remoteIp: req.ip,
        },
        serviceContext: {
            service: config.serviceName,
            version: process.env.GIT_COMMIT || 'unknown',
        },
        '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
        timestamp: new Date().toISOString(),
    };
    console.error(JSON.stringify(errorLog));
    // Report to Sentry if available
    if (sentryModule) {
        sentryModule.captureException(err, {
            extra: {
                method: req.method,
                url: req.originalUrl,
                service: config.serviceName,
            },
        });
    }
    // Send error response
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        service: config.serviceName,
    });
}
