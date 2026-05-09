/**
 * Unified Error Tracking Middleware for Cloud Run Services
 *
 * Provides structured error logging compatible with Cloud Logging
 * and optional Sentry integration for all microservices.
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Creates an error handling middleware for a given service
 */
export declare function createErrorHandler(serviceName: string): (err: Error, req: Request, res: Response, _next: NextFunction) => void;
/**
 * Request logging middleware with trace context
 */
export declare function createRequestLogger(serviceName: string): (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Health check endpoint factory
 */
export declare function createHealthCheck(serviceName: string, dependencies?: Record<string, boolean>): (_req: Request, res: Response) => void;
