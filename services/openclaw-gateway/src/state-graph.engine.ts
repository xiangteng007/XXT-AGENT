/**
 * state-graph.engine.ts — LangGraph-style State Graph Discussion Engine
 *
 * TypeScript implementation of LangGraph's StateGraph pattern.
 * Manages multi-agent round-robin discussions with consensus detection.
 *
 * Flow:
 *   Start → Ask each participant (L1 Ollama) → Check consensus → Next round → ... → Final summary
 *
 * State is persisted through the existing context-store (Memory → Redis → Firestore).
 */

import { logger } from './logger';
import {
    getSession,
    appendTurn,
    closeSession,
    type DeliberationTurn,
} from './context-store';
import {
    generateL1Opinion,
    OllamaUnavailableError,
} from './ollama-inference.service';
import { localRunner } from './local-runner-circuit-breaker';
import { broadcastEvent } from './ws-manager';
import { EventType } from '@xxt-agent/types';

// ── State 定義 ──────────────────────────────────────────────────

export interface AgentMessage {
    agent: string;
    content: string;
    round: number;
    timestamp: number;
    tier: 'L0' | 'L1' | 'L2';
}

export interface DiscussionState {
    taskId: string;
    topic: string;
    context?: string;
    messages: AgentMessage[];
    currentAgent: string;
    agentOutputs: Record<string, string>;
    consensus: string | null;
    iteration: number;
    maxIterations: number;
    participants: string[];
    initiatedBy: string;
    status: 'running' | 'consensus' | 'max_rounds' | 'error';
    createdAt: number;
}

export type DiscussionEventCallback = (event: DiscussionEvent) => void;

export type DiscussionEvent =
    | { type: 'agent_opinion'; agent: string; content: string; round: number }
    | { type: 'round_end'; round: number; consensus: boolean }
    | { type: 'consensus'; summary: string }
    | { type: 'max_rounds'; summary: string }
    | { type: 'error'; message: string };

// ── Agent Role Prompts ──────────────────────────────────────────

const AGENT_ROLE_MAP: Record<string, string> = {
    argus:     '你是 Argus（情報分析師），專精市場雷達、新聞掃描和風險預警。',
    titan:     '你是 Titan（結構工程師），專精 BIM 模型、結構安全和工程規範。',
    lumi:      '你是 Lumi（空間設計師），專精室內設計、空間配置和美學最佳化。',
    rusty:     '你是 Rusty（工料估算師），專精工程估價、數量計算和成本控制。',
    guardian:  '你是 Guardian（保險風控），專精保單分析、風險評估和避險策略。',
    lex:       '你是 Lex（法務顧問），專精合約審查、法規遵循和法律風險。',
    accountant:'你是 Accountant（財務長），專精帳務管理、稅務規劃和現金流。',
    nova:      '你是 Nova（人資總監），專精人力資源、薪資計算和組織管理。',
    scout:     '你是 Scout（商業開發），專精市場開發、客戶關係和業務策略。',
    zora:      '你是 Zora（品牌行銷），專精品牌策略、社群經營和行銷活動。',
    sage:      '你是 Sage（數據分析師），專精數據洞察、報表生成和趨勢預測。',
};

// ── State Graph Engine ──────────────────────────────────────────

export class StateGraphEngine {

    /**
     * Run a full multi-agent discussion.
     * Yields events via the callback for SSE streaming.
     */
    async runDiscussion(
        params: {
            topic: string;
            participants: string[];
            maxIterations?: number;
            context?: string;
            initiatedBy?: string;
        },
        onEvent: DiscussionEventCallback,
    ): Promise<DiscussionState> {
        const taskId = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const maxIterations = params.maxIterations ?? 3;

        const state: DiscussionState = {
            taskId,
            topic: params.topic,
            context: params.context,
            messages: [],
            currentAgent: params.participants[0] ?? '',
            agentOutputs: {},
            consensus: null,
            iteration: 0,
            maxIterations,
            participants: params.participants,
            initiatedBy: params.initiatedBy ?? 'system',
            status: 'running',
            createdAt: Date.now(),
        };

        // Initialize context-store session
        await appendTurn(taskId, {
            agent: 'director',
            tier: 'L0',
            content: `【圓桌討論】${params.topic}`,
            timestamp: Date.now(),
            inference_route: 'local',
        });

        logger.info(`[StateGraph] Discussion started: ${taskId} | topic: ${params.topic} | agents: ${params.participants.join(', ')}`);

        try {
            // Main loop: iterate rounds
            for (let round = 1; round <= maxIterations; round++) {
                state.iteration = round;

                // Each participant gives opinion
                for (const agentId of state.participants) {
                    state.currentAgent = agentId;
                    const opinion = await this.getAgentOpinion(state, agentId, round);

                    const msg: AgentMessage = {
                        agent: agentId,
                        content: opinion,
                        round,
                        timestamp: Date.now(),
                        tier: 'L1',
                    };
                    state.messages.push(msg);
                    state.agentOutputs[agentId] = opinion;

                    // Persist to context-store
                    await appendTurn(taskId, {
                        agent: agentId,
                        tier: 'L1',
                        content: opinion,
                        timestamp: Date.now(),
                        inference_route: 'local',
                    });

                    // Broadcast WebSocket event
                    broadcastEvent({
                        id: crypto.randomUUID(),
                        type: EventType.DELIBERATION_OPINION,
                        source: 'state-graph',
                        severity: 'info',
                        target_agent: agentId,
                        payload: { task_id: taskId, agent: agentId, content: opinion, round },
                        timestamp: new Date().toISOString(),
                    });

                    // SSE callback
                    onEvent({ type: 'agent_opinion', agent: agentId, content: opinion, round });
                }

                // Check consensus
                const consensusResult = await this.checkConsensus(state, round);

                if (consensusResult) {
                    state.consensus = consensusResult;
                    state.status = 'consensus';

                    await closeSession(taskId, consensusResult);

                    onEvent({ type: 'round_end', round, consensus: true });
                    onEvent({ type: 'consensus', summary: consensusResult });

                    logger.info(`[StateGraph] Consensus reached at round ${round}: ${taskId}`);
                    return state;
                }

                onEvent({ type: 'round_end', round, consensus: false });
            }

            // Max rounds reached — generate final summary
            const summary = await this.generateFinalSummary(state);
            state.consensus = summary;
            state.status = 'max_rounds';

            await closeSession(taskId, summary);

            onEvent({ type: 'max_rounds', summary });

            logger.info(`[StateGraph] Max rounds reached: ${taskId}`);
            return state;

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            state.status = 'error';

            onEvent({ type: 'error', message: errorMsg });

            logger.error(`[StateGraph] Discussion error: ${taskId} — ${errorMsg}`);
            return state;
        }
    }

    /**
     * Get a single agent's opinion using Ollama L1 inference.
     */
    private async getAgentOpinion(
        state: DiscussionState,
        agentId: string,
        round: number,
    ): Promise<string> {
        const rolePrompt = AGENT_ROLE_MAP[agentId] ?? `你是 ${agentId}，一位專業顧問。`;

        // Build conversation history for this agent
        const priorOpinions = state.messages
            .filter(m => m.round < round || (m.round === round && m.agent !== agentId))
            .map(m => `[${m.agent}] ${m.content}`)
            .join('\n');

        const contextBlock = state.context ? `\n背景資料：${state.context}\n` : '';

        const systemPrompt = `${rolePrompt}
你正在參與一場多專家圓桌討論。
議題：${state.topic}${contextBlock}
這是第 ${round} 輪討論（共 ${state.maxIterations} 輪）。
請基於你的專業領域，針對議題提出你的專業意見。
如果其他專家已發言，請回應他們的觀點並補充或提出不同看法。
用繁體中文回答，控制在 150 字以內。`;

        const { available } = await localRunner.canUseLocal();

        if (available) {
            try {
                const opinion = await generateL1Opinion(agentId, state.topic, contextBlock, priorOpinions);
                return opinion;
            } catch (err) {
                if (err instanceof OllamaUnavailableError) {
                    return `[${agentId}] 本地模型暫不可用，意見待補充。`;
                }
                throw err;
            }
        }

        return `[${agentId}] Local Runner 離線，等待 L2 仲裁。`;
    }

    /**
     * Check if participants have reached consensus.
     * Uses a "Director" meta-agent to evaluate.
     */
    private async checkConsensus(
        state: DiscussionState,
        round: number,
    ): Promise<string | null> {
        // Don't check consensus on first round (need at least 2 rounds for meaningful consensus)
        if (round < 2) return null;

        const allOpinions = state.messages
            .filter(m => m.round === round)
            .map(m => `[${m.agent}] ${m.content}`)
            .join('\n');

        const { available } = await localRunner.canUseLocal();
        if (!available) return null;

        try {
            const verdict = await generateL1Opinion(
                'director',
                state.topic,
                '',
                `以下是第 ${round} 輪各專家的意見：\n${allOpinions}\n\n請判斷：各專家是否已達成共識？如果是，請用一句話總結共識內容，開頭寫「共識：」。如果尚未達成共識，只回答「尚未達成共識」。`,
            );

            if (verdict.includes('共識：') || verdict.includes('共識:')) {
                return verdict;
            }
        } catch {
            // Consensus check failed — continue discussion
        }

        return null;
    }

    /**
     * Generate a final summary when max rounds are reached without consensus.
     */
    private async generateFinalSummary(state: DiscussionState): Promise<string> {
        const lastRoundOpinions = state.messages
            .filter(m => m.round === state.iteration)
            .map(m => `[${m.agent}] ${m.content}`)
            .join('\n');

        const { available } = await localRunner.canUseLocal();
        if (!available) {
            return `討論已結束（${state.iteration} 輪），因 Local Runner 離線無法生成摘要。`;
        }

        try {
            const summary = await generateL1Opinion(
                'director',
                state.topic,
                '',
                `圓桌討論已進行 ${state.iteration} 輪，以下是最後一輪各專家意見：\n${lastRoundOpinions}\n\n請綜合所有觀點，撰寫一份 200 字以內的決策摘要。`,
            );
            return summary;
        } catch {
            return `討論已結束（${state.iteration} 輪），未能生成自動摘要。`;
        }
    }
}

// ── Singleton ────────────────────────────────────────────────────

export const stateGraphEngine = new StateGraphEngine();
