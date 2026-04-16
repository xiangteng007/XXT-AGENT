import { Router, Request, Response } from 'express';
import { costTracker } from '../cost-tracker';

export const aiCostRouter = Router();

/**
 * @openapi
 * /system/ai-cost:
 *   get:
 *     tags: [System]
 *     summary: 取得 AI 成本與使用統計
 *     description: 回傳各 Agent 的 Token 使用量、推理次數及平均延遲
 *     security: [{ FirebaseAuth: [] }]
 *     responses:
 *       200:
 *         description: 成功回傳統計資料
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_inferences: { type: integer }
 *                     total_tokens: { type: integer }
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       agent_id: { type: string }
 *                       model: { type: string }
 *                       total_tokens: { type: integer }
 *                       inference_count: { type: integer }
 */
aiCostRouter.get('/', (req: Request, res: Response) => {
  const stats = costTracker.getAllStats();
  
  const totalInferences = stats.reduce((s, a) => s + a.inference_count, 0);
  const totalTokens = stats.reduce((s, a) => s + a.total_tokens, 0);

  res.json({
    summary: {
      total_inferences: totalInferences,
      total_tokens: totalTokens,
      timestamp: new Date().toISOString(),
    },
    agents: stats,
  });
});
