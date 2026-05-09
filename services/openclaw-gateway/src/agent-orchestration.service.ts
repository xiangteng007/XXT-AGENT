/**
 * agent-orchestration.service.ts — v9.0 Agent Orchestration Protocol (AOP)
 *
 * 設計目標：
 *   - 讓多個 Agent 可以協同完成複雜的多步驟任務
 *   - 基於 Firestore 持久化任務狀態（容錯重試）
 *   - 冪等鍵防止重複執行
 *   - 支援序列（依賴鏈）和並行（獨立任務）兩種執行模式
 *
 * 任務生命週期：
 *   pending → running → (completed | failed | cancelled)
 *
 * 使用示例：
 * ```ts
 * const wfId = await orchestrationService.createWorkflow({
 *   name: '投資分析週報',
 *   steps: [
 *     { id: 'fetch-news', agentId: 'argus', action: 'FETCH_NEWS', payload: { symbols: ['TSLA'] } },
 *     { id: 'analyze', agentId: 'nova', action: 'ANALYZE', dependsOn: ['fetch-news'] },
 *     { id: 'report', agentId: 'lumi', action: 'GENERATE_REPORT', dependsOn: ['analyze'] },
 *   ],
 *   actor: { uid: 'user-123', source: 'telegram' },
 * });
 * ```
 */

import { logger } from './logger';
import type { AuditActor } from './base-entity-store';

// ── 型別定義 ──────────────────────────────────────────────────

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
  /** 步驟唯一 ID（在 workflow 內唯一） */
  id: string;
  /** 目標 Agent ID（例如 'nova', 'argus', 'lumi'） */
  agentId: string;
  /** Agent 要執行的動作 */
  action: string;
  /** 傳遞給 Agent 的參數 */
  payload?: Record<string, unknown>;
  /** 此步驟依賴的前置步驟 ID 陣列（空陣列 = 可立即執行） */
  dependsOn?: string[];
  /** 最大重試次數（預設 3） */
  maxRetries?: number;
  /** 超時時間（毫秒，預設 30000） */
  timeoutMs?: number;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  actor: AuditActor;
  createdAt: string;
  updatedAt: string;
  /** 冪等鍵（防止重複觸發） */
  idempotencyKey?: string;
  /** 錯誤訊息（status = 'failed' 時） */
  error?: string;
  /** 完成時間 */
  completedAt?: string;
}

export interface StepExecution {
  workflowId: string;
  stepId: string;
  agentId: string;
  action: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  retryCount: number;
}

export interface CreateWorkflowRequest {
  name: string;
  steps: WorkflowStep[];
  actor: AuditActor;
  idempotencyKey?: string;
}

// ── Agent 執行器回調介面 ──────────────────────────────────────

/**
 * Agent 實際執行函式的型別定義
 * 每個 Agent 需要在啟動時透過 `registerAgentExecutor` 注册自己的執行器
 */
export type AgentExecutor = (
  action: string,
  payload: Record<string, unknown>,
  context: { workflowId: string; stepId: string; traceId?: string },
) => Promise<unknown>;

// ── Orchestration Service ─────────────────────────────────────

class AgentOrchestrationService {
  private executors: Map<string, AgentExecutor> = new Map();
  private _db: FirebaseFirestore.Firestore | null = null;

  // ── Firestore 存取 ────────────────────────────────────────

  private getDb(): FirebaseFirestore.Firestore | null {
    if (this._db) return this._db;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDb: getFirestoreDb } = require('./firestore-client') as typeof import('./firestore-client');
      this._db = getFirestoreDb();
    } catch {
      return null;
    }
    return this._db;
  }

  // ── Agent 執行器注册 ──────────────────────────────────────

  /**
   * 注册 Agent 執行器
   * 在 Agent 服務初始化時調用
   */
  public registerAgentExecutor(agentId: string, executor: AgentExecutor): void {
    this.executors.set(agentId, executor);
    logger.info(`[AOP] Registered executor for agent: ${agentId}`);
  }

  // ── Workflow CRUD ─────────────────────────────────────────

  /**
   * 建立並啟動工作流程
   * 如果提供 idempotencyKey，相同 key 的工作流程不會重複建立
   */
  public async createWorkflow(req: CreateWorkflowRequest): Promise<string> {
    const db = this.getDb();

    // 冪等性檢查
    if (req.idempotencyKey && db) {
      const existing = await db
        .collection('_aop_workflows')
        .where('idempotencyKey', '==', req.idempotencyKey)
        .where('status', 'in', ['pending', 'running', 'completed'])
        .limit(1)
        .get();

      if (!existing.empty) {
        const existingId = existing.docs[0]?.id;
        logger.info(`[AOP] Idempotency hit: workflow ${existingId} already exists for key ${req.idempotencyKey}`);
        return existingId!;
      }
    }

    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const workflow: AgentWorkflow = {
      id: workflowId,
      name: req.name,
      steps: req.steps,
      status: 'pending',
      actor: req.actor,
      createdAt: now,
      updatedAt: now,
      idempotencyKey: req.idempotencyKey,
    };

    if (db) {
      await db.collection('_aop_workflows').doc(workflowId).set(workflow);
    }

    logger.info(`[AOP] Workflow created: ${workflowId} (${req.name}) by ${req.actor.uid}`);

    // 非阻塞式執行（不等待完成）
    this.executeWorkflow(workflow).catch((err: unknown) => {
      logger.error(`[AOP] Workflow ${workflowId} execution error: ${err}`);
    });

    return workflowId;
  }

  /**
   * 取得工作流程狀態
   */
  public async getWorkflow(workflowId: string): Promise<AgentWorkflow | null> {
    const db = this.getDb();
    if (!db) return null;

    const doc = await db.collection('_aop_workflows').doc(workflowId).get();
    return doc.exists ? (doc.data() as AgentWorkflow) : null;
  }

  /**
   * 取消工作流程
   */
  public async cancelWorkflow(workflowId: string, reason: string): Promise<void> {
    const db = this.getDb();
    if (!db) return;

    await db.collection('_aop_workflows').doc(workflowId).update({
      status: 'cancelled',
      error: reason,
      updatedAt: new Date().toISOString(),
    });

    logger.info(`[AOP] Workflow ${workflowId} cancelled: ${reason}`);
  }

  // ── 執行引擎 ──────────────────────────────────────────────

  private async executeWorkflow(workflow: AgentWorkflow): Promise<void> {
    const db = this.getDb();

    // 更新狀態為 running
    if (db) {
      await db.collection('_aop_workflows').doc(workflow.id).update({
        status: 'running',
        updatedAt: new Date().toISOString(),
      });
    }

    const completedSteps = new Set<string>();
    const stepResults: Map<string, unknown> = new Map();

    try {
      // 拓撲排序執行（支援依賴鏈）
      let remaining = [...workflow.steps];
      let maxIterations = workflow.steps.length * 2; // 防止無限迴圈

      while (remaining.length > 0 && maxIterations-- > 0) {
        // 找出所有依賴已滿足的步驟（可並行執行）
        const ready = remaining.filter((step) =>
          (step.dependsOn ?? []).every((dep) => completedSteps.has(dep))
        );

        if (ready.length === 0) {
          throw new Error(`[AOP] Deadlock detected in workflow ${workflow.id}: no ready steps`);
        }

        // 並行執行所有就緒步驟
        await Promise.all(
          ready.map(async (step) => {
            const result = await this.executeStep(workflow, step, stepResults);
            completedSteps.add(step.id);
            stepResults.set(step.id, result);
          })
        );

        // 移除已完成步驟
        remaining = remaining.filter((s) => !completedSteps.has(s.id));
      }

      // 全部完成
      if (db) {
        await db.collection('_aop_workflows').doc(workflow.id).update({
          status: 'completed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      logger.info(`[AOP] Workflow ${workflow.id} completed: ${workflow.name}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[AOP] Workflow ${workflow.id} failed: ${errorMsg}`);

      if (db) {
        await db.collection('_aop_workflows').doc(workflow.id).update({
          status: 'failed',
          error: errorMsg,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  private async executeStep(
    workflow: AgentWorkflow,
    step: WorkflowStep,
    previousResults: Map<string, unknown>,
  ): Promise<unknown> {
    const db = this.getDb();
    const maxRetries = step.maxRetries ?? 3;
    const timeoutMs = step.timeoutMs ?? 30000;
    const now = new Date().toISOString();

    const execRef = db
      ? db.collection('_aop_step_executions').doc(`${workflow.id}_${step.id}`)
      : null;

    // 寫入 step 執行記錄
    const stepExec: StepExecution = {
      workflowId: workflow.id,
      stepId: step.id,
      agentId: step.agentId,
      action: step.action,
      status: 'running',
      startedAt: now,
      retryCount: 0,
    };

    if (execRef) await execRef.set(stepExec);

    const executor = this.executors.get(step.agentId);
    if (!executor) {
      // 沒有注册執行器時，記錄 warning 但不中止（允許外部執行）
      logger.warn(`[AOP] No executor registered for agent: ${step.agentId}, step: ${step.id}`);
      if (execRef) {
        await execRef.update({ status: 'completed', completedAt: new Date().toISOString() });
      }
      return null;
    }

    // 帶重試的執行
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 執行 with timeout
        const result = await Promise.race([
          executor(step.action, {
            ...step.payload,
            _previousResults: Object.fromEntries(previousResults),
          }, {
            workflowId: workflow.id,
            stepId: step.id,
            traceId: workflow.actor.traceId,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Step ${step.id} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);

        if (execRef) {
          await execRef.update({
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: JSON.stringify(result),
            retryCount: attempt,
          });
        }

        return result;
      } catch (err) {
        lastErr = err;
        logger.warn(`[AOP] Step ${step.id} attempt ${attempt + 1} failed: ${err}`);

        if (attempt < maxRetries) {
          // 指數退避重試
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // 所有重試失敗
    if (execRef) {
      await execRef.update({
        status: 'failed',
        error: String(lastErr),
        retryCount: maxRetries,
      });
    }

    throw lastErr;
  }
}

// ── Singleton 導出 ────────────────────────────────────────────

export const orchestrationService = new AgentOrchestrationService();
