/**
 * Deliberation Route — M5
 * POST /deliberation/start   開始新 session
 * POST /deliberation/opinion 追加 L1 意見（Ollama）
 * POST /deliberation/close   結束 + 摘要（L2 butler）
 * GET  /deliberation/:taskId 查詢 session 狀態
 *
 * Tier 架構：
 *   L0 — 即時反應（<100ms，rule-based）
 *   L1 — 本地模型（Ollama Qwen2.5，<5s）
 *   L2 — 雲端仲裁（Butler API，按需）
 */

import { Router, Request, Response } from 'express';
import {
    getSession,
    appendTurn,
    closeSession,
    deleteSession,
    DeliberationTurn,
} from '../context-store';
import {
    generateL1Opinion,
    OllamaUnavailableError,
} from '../ollama-inference.service';
import { localRunner } from '../local-runner-circuit-breaker';
import { broadcastEvent } from '../ws-manager';
import { logger } from '../logger';
import { EventType } from '@xxt-agent/types';
import type { OpenClawEvent } from '@xxt-agent/types';

export const deliberationRouter = Router();

// ── POST /deliberation/start ──────────────────────────────────
deliberationRouter.post('/start', async (req: Request, res: Response) => {
    const { task_id, topic, context, initiated_by } = req.body as {
        task_id: string;
        topic: string;
        context?: string;
        initiated_by?: string;
    };

    if (!task_id || !topic) {
        res.status(400).json({ error: 'task_id and topic are required' });
        return;
    }

    const session = await getSession(task_id);
    if (session.turns.length > 0) {
        res.status(409).json({ error: 'Session already exists', task_id });
        return;
    }

    // L0: system 開場（即時）
    const opening: DeliberationTurn = {
        agent: initiated_by ?? 'director',
        tier: 'L0',
        content: `【議題】${topic}`,
        timestamp: Date.now(),
        inference_route: 'local',
    };
    await appendTurn(task_id, opening);

    // 廣播 DELIBERATION_OPINION 事件
    broadcastEvent({
        id: crypto.randomUUID(),
        type: EventType.DELIBERATION_OPINION,
        source: 'gateway',
        severity: 'info',
        payload: { task_id, tier: 'L0', agent: opening.agent, content: opening.content },
        timestamp: new Date().toISOString(),
    });

    logger.info(`[Delib] Session started: ${task_id} | topic: ${topic}`);
    res.json({ ok: true, task_id, session_started: true });
});

// ── POST /deliberation/opinion ────────────────────────────────
deliberationRouter.post('/opinion', async (req: Request, res: Response) => {
    const { task_id, agent_id, tier = 'L1' } = req.body as {
        task_id: string;
        agent_id: string;
        tier?: 'L0' | 'L1' | 'L2';
    };

    if (!task_id || !agent_id) {
        res.status(400).json({ error: 'task_id and agent_id are required' });
        return;
    }

    const session = await getSession(task_id);
    const topic = session.turns[0]?.content.replace('【議題】', '') ?? 'unknown topic';
    const priorText = session.turns
        .filter(t => t.tier !== 'L0')
        .map(t => `[${t.agent}] ${t.content}`)
        .join('\n');

    let content: string;
    let actualRoute: 'local' | 'cloud' = 'local';

    if (tier === 'L1') {
        // 嘗試本地 Ollama
        const { available } = await localRunner.canUseLocal();
        if (available) {
            try {
                content = await generateL1Opinion(agent_id, topic, '', priorText);
                actualRoute = 'local';
            } catch (err) {
                if (err instanceof OllamaUnavailableError) {
                    // 降級：回傳排隊等待 cloud
                    content = `[L1 降級] ${agent_id} 本地模型暫不可用，意見已排隊`;
                    actualRoute = 'cloud';
                } else throw err;
            }
        } else {
            content = `[L1 跳過] Local Runner 離線，${agent_id} 等待 L2 仲裁`;
            actualRoute = 'cloud';
        }
    } else {
        // L0: 簡單 echo（或 L2: 由外部呼叫填入）
        content = req.body.content as string ?? `[${tier}] ${agent_id} 意見待填`;
    }

    const turn: DeliberationTurn = {
        agent: agent_id,
        tier,
        content,
        timestamp: Date.now(),
        inference_route: actualRoute,
    };

    await appendTurn(task_id, turn);

    // 廣播
    broadcastEvent({
        id: crypto.randomUUID(),
        type: EventType.DELIBERATION_OPINION,
        source: 'gateway',
        severity: 'info',
        target_agent: agent_id,
        payload: { task_id, tier, agent: agent_id, content, inference_route: actualRoute },
        timestamp: new Date().toISOString(),
    });

    res.json({ ok: true, turn_added: true, tier, inference_route: actualRoute, content });
});

// ── POST /deliberation/close ──────────────────────────────────
deliberationRouter.post('/close', async (req: Request, res: Response) => {
    const { task_id, final_summary, arbitrated_by = 'director' } = req.body as {
        task_id: string;
        final_summary: string;
        arbitrated_by?: string;
    };

    if (!task_id || !final_summary) {
        res.status(400).json({ error: 'task_id and final_summary are required' });
        return;
    }

    const session = await closeSession(task_id, final_summary);

    // 廣播 L2 仲裁完成
    broadcastEvent({
        id: crypto.randomUUID(),
        type: EventType.DELIBERATION_ARBITRATION,
        source: 'gateway',
        severity: 'info',
        target_agent: arbitrated_by,
        payload: {
            task_id,
            final_summary,
            turns_count: session.turns.length,
            closed_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
    });

    logger.info(`[Delib] Session closed: ${task_id} (${session.turns.length} turns)`);
    res.json({ ok: true, task_id, turns_count: session.turns.length, final_summary });
});

// ── GET /deliberation/:taskId ─────────────────────────────────
deliberationRouter.get('/:taskId', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const session = await getSession(taskId);
    res.json(session);
});

// ── DELETE /deliberation/:taskId ──────────────────────────────
deliberationRouter.delete('/:taskId', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    await deleteSession(taskId);
    res.json({ ok: true, deleted: taskId });
});
