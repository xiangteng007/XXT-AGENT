/**
 * Firebase Auth Middleware
 * Header: Authorization: Bearer <Firebase ID token>
 *
 * 開發模式（DEV_BYPASS_AUTH=true）：跳過驗證，方便本機測試
 */

import { Request, Response, NextFunction } from "express";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { logger } from "../logger";

// S-02: 雙重保護 — 即使 DEV_BYPASS_AUTH=true，生產環境也不會跳過認證
const DEV_BYPASS_AUTH =
  process.env["DEV_BYPASS_AUTH"] === "true" &&
  process.env["NODE_ENV"] !== "production";

// Firebase Admin 初始化（單次）
function ensureFirebaseInit(): void {
  if (getApps().length > 0) return;

  const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  const projectId = process.env["FIREBASE_PROJECT_ID"] ?? "xxt-agent";

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson) as object;
      initializeApp({ credential: cert(serviceAccount) });
    } catch {
      logger.warn(
        "FIREBASE_SERVICE_ACCOUNT_JSON parse failed, falling back to ADC",
      );
      initializeApp({ projectId });
    }
  } else {
    // 本機 ADC（Application Default Credentials）
    initializeApp({ projectId });
  }
}

export async function firebaseAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // 開發模式：跳過
  if (DEV_BYPASS_AUTH) {
    (req as Request & { user?: object }).user = {
      uid: "dev-user",
      role: "admin",
    };
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing Bearer token" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    ensureFirebaseInit();
    const decoded = await getAuth().verifyIdToken(token);
    (req as Request & { user?: object }).user = decoded;
    next();
  } catch (err) {
    logger.warn(`Auth failed: ${err instanceof Error ? err.message : err}`);
    res.status(401).json({ error: "Unauthorized: invalid token" });
  }
}
