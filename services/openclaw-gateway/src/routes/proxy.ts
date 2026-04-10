/**
 * GET /proxy/api/v1/*
 * Proxy skeleton — 將請求轉送到 XXT_API_BASE_URL
 * OAuth /api/v1 路徑規則必須完整保留（不做 path rewrite）
 */

import { Router, Request, Response } from "express";
import { logger } from "../logger";

export const proxyRouter = Router();

const XXT_API_BASE_URL =
  process.env["XXT_API_BASE_URL"] ??
  "https://erp-api-381507943724.asia-east1.run.app";

proxyRouter.all("/api/v1/*", async (req: Request, res: Response) => {
  // 保留完整路徑（含 /api/v1）
  const targetPath = req.path; // e.g. /api/v1/auth/google/callback
  const targetUrl = `${XXT_API_BASE_URL}${targetPath}${
    req.url.includes("?") ? "?" + req.url.split("?")[1] : ""
  }`;

  logger.info(`Proxy → ${req.method} ${targetUrl}`);

  try {
    // 轉發請求 headers（含 Authorization）
    const forwardHeaders: Record<string, string> = {
      "Content-Type": req.headers["content-type"] ?? "application/json",
    };
    if (req.headers.authorization) {
      forwardHeaders["Authorization"] = req.headers.authorization;
    }
    if (req.headers["x-line-signature"]) {
      forwardHeaders["X-Line-Signature"] =
        req.headers["x-line-signature"] as string;
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
    });

    // 透傳 Content-Type（讓 OAuth redirect 正確處理）
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const body = await upstream.text();
    res.status(upstream.status).send(body);
  } catch (err) {
    logger.error(`Proxy error: ${err instanceof Error ? err.message : err}`);
    res.status(502).json({
      error: "Bad Gateway",
      detail: err instanceof Error ? err.message : "upstream error",
    });
  }
});

// 無效路徑提示
proxyRouter.all("*", (_req: Request, res: Response) => {
  res.status(404).json({
    error: "Proxy: path must start with /api/v1/",
    hint: "Use GET /proxy/api/v1/<your-path>",
  });
});
