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
/**
 * Initialize error reporting for a Cloud Run service.
 * Call this once during service startup.
 */
export declare function initErrorReporting(options: ErrorReportingConfig): Promise<void>;
/**
 * Express error handling middleware.
 * Logs errors in Cloud Logging structured format and reports to Sentry if configured.
 */
export declare function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction): void;
export {};
