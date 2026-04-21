import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { logger } from '../../logger';
import { ollamaChat } from '../../ollama-inference.service';
import { guardianSystemPrompt } from '../../prompts';
import { AGENT_ID, MODEL, REGULATION_RAG_URL, queryInsuranceRag } from './shared';

export const chatRouter = Router();

chatRouter.get('/health', async (_req: Request, res: Response) => {
  let ragStatus = 'offline';
  try {
    const r = await fetch(`${REGULATION_RAG_URL}/health`, { signal: AbortSignal.timeout(2000) });
    ragStatus = r.ok ? 'online' : 'degraded';
  } catch { /* offline */ }

  res.json({
    agent_id: AGENT_ID,
    display_name: 'Shield 🐢 (Guardian)',
    mascot: '🐢 玄武',
    status: 'ready',
    model: MODEL,
    inference_route: 'local',
    privacy_level: 'PRIVATE',
    rag_status: ragStatus,
    capabilities: [
      'chat', 'analyze',
      'calc_car', 'calc_pli', 'calc_life', 'calc_workers', 'calc_premium',
      'plan_company', 'plan_personal', 'plan_family', 'plan_full',
      'policy_crud', 'report_gap', 'report_premium',
      'collab_accountant',
    ],
    collab_agents: ['accountant', 'daredevil'],
  });
});

chatRouter.post('/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body as { message?: string; context?: string };
  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

  const traceId = crypto.randomUUID();

  let ragContext = '';
  if (/保險|保單|保額|理賠|保費|投保|意外|壽險|醫療|職災|工程險|公共責任/.test(message)) {
    ragContext = await queryInsuranceRag(message);
  }

  const userContent = ragContext
    ? `【相關保險法規（自動擷取）】\n${ragContext}\n\n---\n\n【諮詢問題】${message}${context ? `\n\n【背景】${context}` : ''}`
    : `${message}${context ? `\n\n【背景資訊】${context}` : ''}`;

  try {
    const { content: reply, latency_ms } = await ollamaChat(
      [
        { role: 'system', content: guardianSystemPrompt.template },
        { role: 'user', content: userContent },
      ],
      MODEL,
      { temperature: 0.1, num_predict: 2048 },
    );

    logger.info(`[Guardian/chat] trace=${traceId} latency=${latency_ms}ms rag=${ragContext ? 'hit' : 'none'}`);
    res.json({
      agent_id: AGENT_ID, model: MODEL,
      inference_route: 'local', privacy_level: 'PRIVATE',
      rag_used: ragContext ? 'insurance' : null,
      trace_id: traceId, latency_ms,
      reply: reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim(),
    });
  } catch (err) {
    res.status(500).json({ error: '保險諮詢 AI 異常', details: String(err) });
  }
});
