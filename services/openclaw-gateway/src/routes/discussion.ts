/**
 * Discussion Route — LangGraph State Graph Multi-Agent Discussion
 *
 * POST /agents/discuss       — Start a new round-table discussion (SSE streaming)
 * GET  /agents/discuss/:id   — Query discussion state
 * POST /agents/discuss/:id/inject — Human operator injects opinion
 *
 * Uses StateGraphEngine for structured multi-agent discussions with
 * automatic consensus detection and round-robin participation.
 */

import { Router, Request, Response } from 'express';
import { stateGraphEngine, type DiscussionEvent, type DiscussionState } from '../state-graph.engine';
import { getSession, appendTurn, type DeliberationTurn } from '../context-store';
import { logger } from '../logger';

export const discussionRouter = Router();

// Track active discussions for GET queries
const activeDiscussions = new Map<string, DiscussionState>();

// ── POST /agents/discuss ──────────────────────────────────────

/**
 * @openapi
 * /agents/discuss:
 *   post:
 *     tags: [Discussion]
 *     summary: 開始多 Agent 圓桌討論
 *     description: |
 *       啟動 LangGraph State Graph 驅動的多代理人圓桌討論。
 *       回應為 SSE (Server-Sent Events) 串流，即時推送每位 Agent 的意見。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topic, participants]
 *             properties:
 *               topic:
 *                 type: string
 *                 description: 討論議題
 *                 example: "如何在銅價飆漲下維持專案利潤率？"
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 參與 Agent ID 清單
 *                 example: ["argus", "titan", "rusty", "guardian"]
 *               max_iterations:
 *                 type: integer
 *                 default: 3
 *                 description: 最大討論輪數
 *               context:
 *                 type: string
 *                 description: 可選的背景資料
 *     responses:
 *       200:
 *         description: SSE stream 即時推送討論事件
 */
discussionRouter.post('/', async (req: Request, res: Response) => {
    const { topic, participants, max_iterations, context } = req.body as {
        topic: string;
        participants: string[];
        max_iterations?: number;
        context?: string;
    };

    // Validation
    if (!topic || !participants || !Array.isArray(participants) || participants.length < 2) {
        res.status(400).json({
            error: 'topic (string) and participants (array with >= 2 agents) are required',
        });
        return;
    }

    const validAgents = [
        'argus', 'titan', 'lumi', 'rusty', 'guardian',
        'lex', 'accountant', 'nova', 'scout', 'zora', 'sage',
    ];
    const invalidAgents = participants.filter(p => !validAgents.includes(p));
    if (invalidAgents.length > 0) {
        res.status(400).json({
            error: `Unknown agents: ${invalidAgents.join(', ')}`,
            valid_agents: validAgents,
        });
        return;
    }

    // Check Accept header for SSE preference
    const wantsSSE = req.headers.accept?.includes('text/event-stream');

    if (wantsSSE) {
        // SSE streaming mode
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        });

        const sendSSE = (event: DiscussionEvent) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        const state = await stateGraphEngine.runDiscussion(
            {
                topic,
                participants,
                maxIterations: max_iterations ?? 3,
                context,
                initiatedBy: (req as unknown as { user?: { uid?: string } }).user?.uid ?? 'api',
            },
            sendSSE,
        );

        activeDiscussions.set(state.taskId, state);

        // Auto-cleanup after 1 hour
        setTimeout(() => activeDiscussions.delete(state.taskId), 3600_000);

        res.write(`data: ${JSON.stringify({ type: 'done', taskId: state.taskId, status: state.status })}\n\n`);
        res.end();
    } else {
        // JSON mode (wait for completion)
        const events: DiscussionEvent[] = [];

        const state = await stateGraphEngine.runDiscussion(
            {
                topic,
                participants,
                maxIterations: max_iterations ?? 3,
                context,
                initiatedBy: (req as unknown as { user?: { uid?: string } }).user?.uid ?? 'api',
            },
            (event) => events.push(event),
        );

        activeDiscussions.set(state.taskId, state);
        setTimeout(() => activeDiscussions.delete(state.taskId), 3600_000);

        res.json({
            ok: true,
            taskId: state.taskId,
            topic: state.topic,
            participants: state.participants,
            rounds: state.iteration,
            status: state.status,
            consensus: state.consensus,
            messages: state.messages,
            events,
        });
    }
});

// ── GET /agents/discuss/:taskId ───────────────────────────────

discussionRouter.get('/:taskId', async (req: Request, res: Response) => {
    const { taskId } = req.params;

    // Check in-memory first
    const cached = activeDiscussions.get(taskId);
    if (cached) {
        res.json({
            ok: true,
            ...cached,
        });
        return;
    }

    // Fallback to context-store
    const session = await getSession(taskId);
    if (session.turns.length === 0) {
        res.status(404).json({ error: `Discussion ${taskId} not found` });
        return;
    }

    res.json({
        ok: true,
        taskId,
        turns: session.turns,
        closed: session.closed ?? false,
        final_summary: session.final_summary ?? null,
    });
});

// ── POST /agents/discuss/:taskId/inject ───────────────────────

discussionRouter.post('/:taskId/inject', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { content, agent_id = 'operator' } = req.body as {
        content: string;
        agent_id?: string;
    };

    if (!content) {
        res.status(400).json({ error: 'content is required' });
        return;
    }

    const turn: DeliberationTurn = {
        agent: agent_id,
        tier: 'L2',
        content,
        timestamp: Date.now(),
        inference_route: 'cloud',
    };

    await appendTurn(taskId, turn);

    logger.info(`[Discussion] Human injection into ${taskId} by ${agent_id}`);
    res.json({ ok: true, taskId, injected: true });
});
