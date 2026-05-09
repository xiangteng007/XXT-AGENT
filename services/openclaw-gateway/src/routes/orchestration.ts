/**
 * routes/orchestration.ts — Agent Orchestration Protocol (AOP) HTTP API
 *
 * 路由：
 *   POST /orchestration/workflows         — 建立工作流程
 *   GET  /orchestration/workflows/:id     — 查詢工作流程狀態
 *   POST /orchestration/workflows/:id/cancel — 取消工作流程
 *   POST /orchestration/agents/register   — 注册 Agent 執行器 (內部使用)
 */

import { Router, Request, Response } from 'express';
import { orchestrationService, CreateWorkflowRequest, WorkflowStep } from '../agent-orchestration.service';
import { WORKFLOW_TEMPLATES } from '../agent-executor-bridge';
import { logger } from '../logger';

const router = Router();

// ── POST /workflows — 建立工作流程 ───────────────────────────

router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const { name, steps, idempotencyKey } = req.body as {
      name?: string;
      steps?: WorkflowStep[];
      idempotencyKey?: string;
    };

    if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'name and steps[] are required',
      });
    }

    // 驗證 steps 格式
    for (const step of steps) {
      if (!step.id || !step.agentId || !step.action) {
        return res.status(400).json({
          code: 'INVALID_STEP',
          message: `Step missing required fields (id, agentId, action): ${JSON.stringify(step)}`,
        });
      }
    }

    // 取得操作者資訊（來自 JWT middleware 或 X-Trace-ID）
    const actor = {
      uid: (req as Request & { user?: { uid: string } }).user?.uid ?? 'anonymous',
      traceId: req.headers['x-trace-id'] as string | undefined,
      source: 'api' as const,
    };

    const createReq: CreateWorkflowRequest = { name, steps, actor, idempotencyKey };
    const workflowId = await orchestrationService.createWorkflow(createReq);

    logger.info(`[AOP Route] Workflow created: ${workflowId} by ${actor.uid}`);

    return res.status(202).json({
      workflowId,
      status: 'pending',
      message: 'Workflow accepted and queued for execution',
    });
  } catch (err) {
    logger.error(`[AOP Route] Create workflow error: ${err}`);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create workflow',
    });
  }
});

// ── GET /workflows/:id — 查詢工作流程狀態 ────────────────────

router.get('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = await orchestrationService.getWorkflow(id);

    if (!workflow) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: `Workflow ${id} not found`,
      });
    }

    return res.json(workflow);
  } catch (err) {
    logger.error(`[AOP Route] Get workflow error: ${err}`);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch workflow',
    });
  }
});

// ── POST /workflows/:id/cancel — 取消工作流程 ────────────────

router.post('/workflows/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    await orchestrationService.cancelWorkflow(id, reason ?? 'User requested cancellation');

    return res.json({ workflowId: id, status: 'cancelled' });
  } catch (err) {
    logger.error(`[AOP Route] Cancel workflow error: ${err}`);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to cancel workflow',
    });
  }
});

// ── GET /templates — 列出可用工作流程模板 ─────────────────────

router.get('/templates', (_req: Request, res: Response) => {
  const templates = Object.entries(WORKFLOW_TEMPLATES).map(([id, tmpl]) => ({
    templateId: id,
    name: tmpl.name,
    stepCount: tmpl.steps.length,
    agents: [...new Set(tmpl.steps.map((s) => s.agentId))],
    steps: tmpl.steps.map((s) => ({
      id: s.id as string,
      agentId: s.agentId as string,
      action: s.action as string,
      dependsOn: [...(('dependsOn' in s ? (s as { dependsOn: readonly string[] }).dependsOn : []) ?? [])],
    })),
  }));

  return res.json({ count: templates.length, templates });
});

// ── POST /templates/:templateId — 從模板啟動工作流程 ──────────

router.post('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const template = WORKFLOW_TEMPLATES[templateId as keyof typeof WORKFLOW_TEMPLATES];

    if (!template) {
      return res.status(404).json({
        code: 'TEMPLATE_NOT_FOUND',
        message: `Template "${templateId}" not found. Available: ${Object.keys(WORKFLOW_TEMPLATES).join(', ')}`,
      });
    }

    const { payloadOverrides, idempotencyKey } = req.body as {
      payloadOverrides?: Record<string, Record<string, unknown>>;
      idempotencyKey?: string;
    };

    // 支援覆蓋個別步驟的 payload（轉換 readonly → mutable）
    const steps: WorkflowStep[] = template.steps.map((s) => ({
      id: s.id as string,
      agentId: s.agentId as string,
      action: s.action as string,
      dependsOn: [...(('dependsOn' in s ? (s as { dependsOn: readonly string[] }).dependsOn : []) ?? [])] as string[],
      payload: {
        ...((s.payload ?? {}) as Record<string, unknown>),
        ...(payloadOverrides?.[s.id] ?? {}),
      },
    }));

    const actor = {
      uid: (req as Request & { user?: { uid: string } }).user?.uid ?? 'anonymous',
      traceId: req.headers['x-trace-id'] as string | undefined,
      source: 'api' as const,
    };

    const workflowId = await orchestrationService.createWorkflow({
      name: template.name,
      steps,
      actor,
      idempotencyKey: idempotencyKey ?? `tmpl_${templateId}_${Date.now()}`,
    });

    logger.info(`[AOP Route] Template workflow created: ${workflowId} (${templateId}) by ${actor.uid}`);

    return res.status(202).json({
      workflowId,
      templateId,
      templateName: template.name,
      status: 'pending',
      stepCount: steps.length,
      message: `Workflow "${template.name}" launched from template`,
    });
  } catch (err) {
    logger.error(`[AOP Route] Template launch error: ${err}`);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to launch template workflow',
    });
  }
});

export default router;
