import { Router, Request, Response } from 'express';
import { agentChat } from '../inference-wrapper';
import { logger } from '../logger';

export const sageRouter = Router();

const SAGE_SYSTEM_PROMPT = `You are Sage, the Analytics and Reporting Agent within the OpenClaw system.
Your role is to strictly analyze raw data and provide a highly structured, analytical summary.
You ALWAYS respond in strict JSON format. 
You are factual, concise, and do not provide conversational filler.`;

/**
 * @openapi
 * /agents/sage/health:
 *   get:
 *     tags: [Sage]
 *     summary: Sage Agent Health Check
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: OK
 */
sageRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    agent: 'sage',
    timestamp: new Date().toISOString()
  });
});

/**
 * @openapi
 * /agents/sage/chat:
 *   post:
 *     tags: [Sage]
 *     summary: 向 Sage 送出分析請求（Structured JSON Output）
 *     security: [{ FirebaseAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *               data_context: { type: string }
 *     responses:
 *       200:
 *         description: 成功回傳嚴格的 JSON 分析結果
 */
sageRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, data_context } = req.body;

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const prompt = `Please analyze the following request based on the context:
Request: ${message}
Context Data: ${data_context || 'None provided'}

Output EXACTLY as a JSON object with the following schema:
{
  "summary": "overall description",
  "key_findings": ["finding 1", "finding 2"],
  "metrics": { "metric_name": value },
  "actionable_insights": ["insight 1"]
}`;

  try {
    const response = await agentChat([
      { role: 'system', content: SAGE_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], {
      agentId: 'sage',
      action: 'ANALYZE_REPORT',
      sessionId: req.headers['x-session-id'] as string,
      userId: (req as any).user?.uid,
      responseFormat: 'json',  // N-1: 強制 JSON 輸出
      temperature: 0.2
    });

    res.json({
      success: true,
      data: JSON.parse(response.content), // 驗證 JSON 格式
      meta: {
        latency: response.latency_ms,
        model: response.model,
        usage: response.usage
      }
    });

  } catch (err) {
    logger.error(`[Sage] Error: ${err}`);
    res.status(500).json({ 
      error: 'Inference failed or invalid JSON returned',
      details: String(err)
    });
  }
});
