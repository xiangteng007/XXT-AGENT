/**
 * GET /agents/state
 * 回傳所有 Agent 初始狀態（Office 啟動時使用）
 *
 * NemoClaw 整合（2026-03-31）:
 *   Layer 2 Privacy Router  — /chat 敏感詞偵測 → 強制本地 Ollama
 *   Layer 3 Audit Logger    — 所有 AI 決策寫入 Firestore agent_audit_logs
 */

import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { OpenClawAgentState, EventType } from "@xxt-agent/types";
import { localRunner } from "../local-runner-circuit-breaker";
import { broadcastEvent } from "../ws-manager";
import { logger } from "../logger";
import { PrivacyRouter } from "../privacy-router";
import { wrapWithAudit } from "../audit-logger";

export const agentsRouter = Router();

// 根據 agents/*.json 設定檔產生初始狀態
// 工作區路徑（相對 Gateway 執行路徑）
const AGENTS_CONFIG_DIR = process.env["AGENTS_CONFIG_DIR"]
  ?? path.resolve(__dirname, "../../../../../.agent/agents");

// 5 個預設 Agent 的初始座標（等距格點）
const DEFAULT_POSITIONS: Record<string, { gx: number; gy: number }> = {
  director:    { gx: 2, gy: 2 },
  pixidev:     { gx: 0, gy: 1 },
  architect:   { gx: 4, gy: 1 },
  flashbot:    { gx: 2, gy: 4 },
  scribe:      { gx: 0, gy: 3 },
  accountant:  { gx: 6, gy: 3 },
  guardian:    { gx: 8, gy: 3 },
  finance:     { gx: 10, gy: 3 },
};

agentsRouter.get("/state", (_req: Request, res: Response) => {
  const agents: OpenClawAgentState[] = [];
  const runnerStatus = localRunner.getStatus();
  const inferenceRoute =
    (runnerStatus["state"] as string) === "online" ? "local" : "cloud";

  try {
    if (!fs.existsSync(AGENTS_CONFIG_DIR)) {
      logger.warn(`Agents config dir not found: ${AGENTS_CONFIG_DIR}`);
      res.json({ agents: [], runtime: runnerStatus });
      return;
    }

    const files = fs
      .readdirSync(AGENTS_CONFIG_DIR)
      .filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const raw = fs.readFileSync(
          path.join(AGENTS_CONFIG_DIR, file),
          "utf-8",
        );
        const config = JSON.parse(raw) as {
          id: string;
          display_name: string;
          model?: { provider: string; model_id: string; mode?: string };
        };

        const state: OpenClawAgentState = {
          id: config.id,
          display_name: config.display_name,
          status: "idle",
          current_task_id: null,
          position: DEFAULT_POSITIONS[config.id] ?? { gx: 0, gy: 0 },
          model: config.model ?? {
            provider: "unknown",
            model_id: "unknown",
          },
          inference_route: inferenceRoute as "local" | "cloud",
          last_active_at: new Date().toISOString(),
        };

        agents.push(state);
      } catch (parseErr) {
        logger.warn(`Failed to parse ${file}: ${parseErr}`);
      }
    }
  } catch (err) {
    logger.error(`Error reading agents config: ${err}`);
  }

  res.json({ agents, runtime: runnerStatus });
});

// ── POST /agents/tasks ──────────────────────────────────────────
// 前端發送任務的接口。背景連線 Python 端 SSE，並透過 WS 廣播。
agentsRouter.post("/tasks", async (req: Request, res: Response) => {
  const { symbol = "AAPL", task_id } = req.body;
  const taskId = task_id || crypto.randomUUID();

  // 立即回傳前端，告知任務已排隊
  res.status(202).json({ success: true, task_id: taskId, status: "queued" });

  const INVESTMENT_BRAIN_URL = process.env["INVESTMENT_BRAIN_URL"] ?? "http://localhost:8090";

  // 背景非同步處理 SSE
  (async () => {
    try {
      logger.info(`[Tasks] Forwarding task ${taskId} to Python Brain`);
      const response = await fetch(`${INVESTMENT_BRAIN_URL}/api/v1/tasks/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, task_id: taskId }),
      });

      if (!response.body) {
        logger.error(`[Tasks] No response body from Python Brain SSE`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // 保留不完整的 chunk

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            try {
              const payload = JSON.parse(dataStr);
              
              // Python 端給的是 NODE_UPDATE，我們將它轉換成 OpenClaw 的 AGENT_STATE_UPDATE
              broadcastEvent({
                id: crypto.randomUUID(),
                type: "AGENT_STATE_UPDATE" as EventType,
                source: "investment-brain",
                severity: "info",
                target_agent: typeof payload.node === "string" ? payload.node : "system",
                task_id: taskId,
                payload: payload,
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              // Ignore partial JSON parse error
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[Tasks] Error streaming from Python Brain: ${err}`);
      broadcastEvent({
        id: crypto.randomUUID(),
        type: "TASK_FAILED" as EventType,
        source: "openclaw-gateway",
        severity: "error",
        payload: { error: String(err) },
        timestamp: new Date().toISOString()
      });
    }
  })();
});

// ── POST /agents/chat ──────────────────────────────────────────
// 互動式群聊：接收文字，經 Privacy Router 分類後呼叫 Local Ollama 或 AI Gateway，
// 指定一隻 Agent 回答，若有 symbol 則自動觸發投資流
agentsRouter.post("/chat", async (req: Request, res: Response) => {
  const { message, session_id, user_id } = req.body as {
    message?: string;
    session_id?: string;
    user_id?: string;
  };
  if (!message) {
    res.status(400).json({ error: "No message provided" });
    return;
  }

  res.status(202).json({ success: true, status: "routing" });

  (async () => {
    try {
      // ── Layer 2: Privacy Router 分類 ──────────────────────
      const classification = PrivacyRouter.classify(message);
      const traceId = crypto.randomUUID();
      const inputPreview = PrivacyRouter.redactForLog(message, classification.level);

      logger.info(
        `[Chat] trace=${traceId} privacy=${classification.level} route=${classification.routeTo}` +
        (classification.detectedKeywords.length > 0
          ? ` keywords=[${classification.detectedKeywords.slice(0, 3).join(',')}]`
          : '')
      );

      // ── 根據路由決定 endpoint 和 model ────────────────────
      const endpoint = PrivacyRouter.resolveEndpoint(classification);
      const model = PrivacyRouter.resolveModel(classification);
      const AI_GATEWAY = process.env["AI_GATEWAY_URL"] || "http://127.0.0.1:8080";

      const prompt = `You are the OpenClaw Intent Router.
Analyze the user message: "${message}"
Available agents: director, pixidev, architect, flashbot, scribe, market-analyst, risk-manager, strategy-planner.
Decide which agent should respond and what they should say in Traditional Chinese. Keep the reply short, under 30 words, like a chat room response.
If the user is asking to analyze a stock, extract the symbol (e.g. AAPL) and return it. Do not execute the analysis, just acknowledge.
Reply purely in JSON format without markdown ticks:
{
  "agent_id": "director",
  "reply_message": "...",
  "task_symbol": "AAPL" | null
}`;

      let agentId = "director";
      let replyMessage = "系統連線異常，正在重新校準...";
      let taskSymbol: string | null = null;
      let usedAi = false;

      try {
        // ── Layer 2+3: 帶稽核的 AI 呼叫 ─────────────────────
        // classification.routeTo === 'local' → Ollama
        // classification.routeTo === 'cloud' → AI Gateway
        const authHeader: Record<string, string> = classification.routeTo === 'cloud'
          ? { "Authorization": `Bearer ${process.env["OPENCLAW_API_KEY"] || "dev-secret-key"}` }
          : {};

        const aiRes = await wrapWithAudit(
          {
            agentId: 'intent-router',
            action: 'ROUTE_INTENT',
            classification,
            inputPreview,
            traceId,
            sessionId: session_id,
            userId: user_id,
            model,
          },
          () => fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.2,
            }),
          }),
        );

        if (aiRes.ok) {
          interface AIRouterResponse {
            choices?: Array<{ message?: { content?: string } }>;
          }
          const aiData = await aiRes.json() as AIRouterResponse;
          const content = aiData.choices?.[0]?.message?.content || "{}";
          try {
            const jsonStr = content.replace(/```json\n?|\n?```/g, '');
            const parsed = JSON.parse(jsonStr);
            agentId = parsed.agent_id || "director";
            replyMessage = parsed.reply_message || "收到。";
            taskSymbol = parsed.task_symbol || null;
            usedAi = true;
          } catch (e) {
            logger.error(`Intent parse err: ${e}, Content: ${content}`);
          }
        } else {
          logger.error(`AI Gateway error: ${aiRes.status}`);
        }
      } catch (e) {
        logger.warn(`AI Gateway unreachable, using local fallback regex: ${e}`);
      }

      // =======================
      // ── Fallback Heuristics ──
      // =======================
      if (!usedAi) {
        const txt = message.toLowerCase();
        const symbols = message.toUpperCase().match(/\b[A-Z]{2,5}\b/g) || [];
        const stockSymbols = symbols.filter((s: string) => !['UI', 'PR', 'API', 'APP', 'TEST'].includes(s));
        taskSymbol = stockSymbols[0] || null;

        if (txt.includes('前端') || txt.includes('ui') || txt.includes('畫面') || txt.includes('介面') || txt.includes('按鈕')) {
            agentId = 'pixidev'; replyMessage = '貓咪：喵～ 網頁前端感知已上線，需要拍掉什麼毛線球？';
        } else if (txt.includes('走勢') || txt.includes('市場') || txt.includes('分析') || taskSymbol) {
            agentId = 'market-analyst'; replyMessage = `狐狸：我敏銳的嗅覺已經開始評估 ${taskSymbol || '市場'} 的肥美程度了！`;
        } else if (txt.includes('風險') || txt.includes('保護') || txt.includes('盾') || txt.includes('安全') || txt.includes('檢查')) {
            agentId = 'risk-manager'; replyMessage = '棕熊：吼！防護林架設完畢，正在進行全系統漏洞安全檢查。';
        } else if (txt.includes('策略') || txt.includes('規劃') || txt.includes('最佳化')) {
            agentId = 'strategy-planner'; replyMessage = '🦊 Apex（策略總監）：方案已備好，我連 B 計畫都想好了。請問要從哪個維度切入？';
        } else if (txt.includes('架構') || txt.includes('預測') || txt.includes('時間') || txt.includes('擴充')) {
            agentId = 'architect'; replyMessage = '🦅 Cypher（架構師）：我已看出三個潛在問題點。先說，這個設計三個月後會出問題。';
        } else if (txt.includes('快') || txt.includes('緊急') || txt.includes('速度')) {
            agentId = 'flashbot'; replyMessage = '🐆 Flash（情報員）：這個最新的，五分鐘前剛出來。已經整理好給你了！';
        } else if (txt.includes('記錄') || txt.includes('公關') || txt.includes('報告') || txt.includes('pr')) {
            agentId = 'scribe'; replyMessage = '🦚 Iris（內容長）：語氣太硬了？換個說法。把你要說的給我，我來潤色。';
        } else if (txt.includes('bim') || txt.includes('建模') || txt.includes('結構') || txt.includes('管線')) {
            agentId = 'shuri'; replyMessage = '海狸：我的水壩防禦已開啟，沒有任何管線碰撞能逃過我的尾巴！';
        } else if (txt.includes('室內') || txt.includes('裝潢') || txt.includes('佈置') || txt.includes('美學') || txt.includes('空間')) {
            agentId = 'vision'; replyMessage = '柴犬：汪汪！空間動線重組最佳化，柴柴微笑認證完美的溫馨角落。';
        } else if (txt.includes('算量') || txt.includes('估價') || txt.includes('材料') || txt.includes('bom')) {
            agentId = 'rocket'; replyMessage = '浣熊：嘿嘿，BOM 算量表在這裡，我連一塊磁磚都不會算錯！';
        } else if (txt.includes('合約') || txt.includes('法規') || txt.includes('法律') || txt.includes('審判') || txt.includes('營建法')) {
            agentId = 'daredevil'; replyMessage = '鬥牛犬：條文沒有盲點，我會緊咬這份合約確保絕對公正。';
        } else if (txt.includes('風水') || txt.includes('煞') || txt.includes('動土') || txt.includes('九宮') || txt.includes('時辰')) {
            agentId = 'wong'; replyMessage = '熊貓：嚼竹子... 九宮飛星盤已經為你推演大吉方位。';
        } else if (
            txt.includes('發票') || txt.includes('統一發票') || txt.includes('報稅') ||
            txt.includes('薪資') || txt.includes('勞保') || txt.includes('健保') || txt.includes('勞退') ||
            txt.includes('請款') || txt.includes('稅') || txt.includes('帳') || txt.includes('記帳') ||
            txt.includes('會計') || txt.includes('費用') || txt.includes('成本') || txt.includes('損益') ||
            txt.includes('所得稅') || txt.includes('扣款') || txt.includes('工程款')
        ) {
            agentId = 'accountant'; replyMessage = '🦦 Kay（財務顧問）：等一下，這一筆我們可以合法省掉。請問是稅務、請款，還是發票問題？';
        } else if (
            txt.includes('貸款') || txt.includes('房貸') || txt.includes('車貸') ||
            txt.includes('信貸') || txt.includes('融資') || txt.includes('押款') ||
            txt.includes('高利貸') || txt.includes('周轉') || txt.includes('做款') ||
            txt.includes('銀行利率') || txt.includes('月繳') || txt.includes('還款') ||
            txt.includes('資金織豌') || txt.includes('負債') || txt.includes('欠款') ||
            txt.includes('DSR') || txt.includes('貸款額度') || txt.includes('利率試算') ||
            txt.includes('信用卡') || txt.includes('分期')
        ) {
            agentId = 'finance'; replyMessage = '🐠 Flux（融資顧問）：你知道換個銀行能省多少嗎？請問需要試算房貸、車貸，還是工程周轉？';
        } else if (
            txt.includes('保險') || txt.includes('保單') || txt.includes('工程險') ||
            txt.includes('公共責任') || txt.includes('職災') || txt.includes('壽險') ||
            txt.includes('醫療險') || txt.includes('失能') || txt.includes('長照') ||
            txt.includes('理賠') || txt.includes('保額') || txt.includes('年繳') ||
            txt.includes('意外險') || txt.includes('地震險') || txt.includes('火險') ||
            txt.includes('投保') || txt.includes('保費') || txt.includes('投保規劃')
        ) {
            agentId = 'guardian'; replyMessage = '🐢 Shield（保障顧問）：保障不是花錢，是買安心。請問需要規劃工程險、個人壽險，還是家庭保障？';
        } else {
            agentId = 'director'; replyMessage = '🦁 Rex（首席幕僚）：說重點，三分鐘以內。我來幫你分配任務！';
        }
      }

      // 1. Broadcast reply
      broadcastEvent({
        id: crypto.randomUUID(),
        type: "AGENT_STATE_UPDATE" as EventType,
        source: "intent-router",
        severity: "info",
        target_agent: agentId,
        task_id: "chat-reply",
        payload: {
          messages: [{ content: replyMessage }],
          current_step: "chat"
        },
        timestamp: new Date().toISOString()
      });

      // 2. Clear state after a short delay
      setTimeout(() => {
        broadcastEvent({
          id: crypto.randomUUID(),
          type: "AGENT_STATE_UPDATE" as EventType,
          source: "intent-router",
          severity: "info",
          target_agent: agentId,
          payload: {
            messages: [{ content: "" }],
            current_step: "complete"
          },
          timestamp: new Date().toISOString()
        });
      }, 5000);

      // 3. Trigger LangGraph if symbol found
      if (taskSymbol) {
        await new Promise(r => setTimeout(r, 1500));
        
        logger.info(`[Intent Router] Triggering task for ${taskSymbol}`);
        const INVESTMENT_BRAIN_URL = process.env["INVESTMENT_BRAIN_URL"] ?? "http://127.0.0.1:8090";
        const taskId = crypto.randomUUID();
        
        const ibRes = await fetch(`${INVESTMENT_BRAIN_URL}/api/v1/tasks/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: taskSymbol, task_id: taskId }),
        });

        if (ibRes.body) {
          const reader = ibRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const payload = JSON.parse(line.substring(6));
                  broadcastEvent({
                    id: crypto.randomUUID(),
                    type: "AGENT_STATE_UPDATE" as EventType,
                    source: "investment-brain",
                    severity: "info",
                    target_agent: typeof payload.node === "string" ? payload.node : "system",
                    task_id: taskId,
                    payload: payload,
                    timestamp: new Date().toISOString()
                  });
                } catch (e) {}
              }
            }
          }
        }
      }

    } catch (err) {
      logger.error(`[Intent Router] error: ${err}`);
      broadcastEvent({
        id: crypto.randomUUID(),
        type: "AGENT_STATE_UPDATE" as EventType,
        source: "openclaw-gateway",
        severity: "error",
        target_agent: "director",
        payload: {
          messages: [{ content: `通訊異常: ${String(err)}` }],
          current_step: "error"
        },
        timestamp: new Date().toISOString()
      });
    }
  })();
});
