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

import { Request, Response, NextFunction } from 'express';

interface ErrorReportingConfig {
    /** Name of the Cloud Run service */
    serviceName: string;
    /** GCP project ID (auto-detected from env) */
    projectId?: string;
    /** Optional Sentry DSN for external error tracking */
    sentryDsn?: string;
}

let config: ErrorReportingConfig = {
    serviceName: 'unknown-service',
};

let sentryModule: any = null;

/**
 * Initialize error reporting for a Cloud Run service.
 * Call this once during service startup.
 */
export async function initErrorReporting(options: ErrorReportingConfig): Promise<void> {
    config = {
        ...options,
        projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'xxt-agent',
    };

    // Try to initialize Sentry if DSN is provided
    if (options.sentryDsn || process.env.SENTRY_DSN) {
        try {
            sentryModule = await import('@sentry/node');
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
        } catch (e) {
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
export function errorMiddleware(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
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
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        service: config.serviceName,
    });
}
