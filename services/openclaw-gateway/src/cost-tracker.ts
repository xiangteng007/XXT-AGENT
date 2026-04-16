import { logger } from './logger';

export interface UsageMetrics {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
}

export interface AgentUsageSummary {
  agent_id: string;
  model: string;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_latency_ms: number;
  inference_count: number;
  last_used: string;
}

class CostTracker {
  private summaries: Map<string, AgentUsageSummary> = new Map();
  private _db: any = null;

  private getDb() {
    if (this._db) return this._db;
    try {
      const { getDb } = require('./firestore-client');
      this._db = getDb();
      return this._db;
    } catch {
      return null;
    }
  }

  /**
   * 記錄一次推理的使用情況
   */
  public async recordUsage(
    agentId: string,
    model: string,
    metrics: UsageMetrics
  ) {
    const key = `${agentId}:${model}`;
    const now = new Date().toISOString();

    // 1. 更新記憶體摘要
    let summary = this.summaries.get(key);
    if (!summary) {
      summary = {
        agent_id: agentId,
        model,
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_tokens: 0,
        total_latency_ms: 0,
        inference_count: 0,
        last_used: now,
      };
    }

    summary.total_prompt_tokens += metrics.prompt_tokens;
    summary.total_completion_tokens += metrics.completion_tokens;
    summary.total_tokens += metrics.total_tokens;
    summary.total_latency_ms += metrics.latency_ms;
    summary.inference_count += 1;
    summary.last_used = now;

    this.summaries.set(key, summary);

    // 2. 持久化至 Firestore (Async)
    void this.persistUsage(agentId, model, metrics, summary);
  }

  private async persistUsage(
    agentId: string,
    model: string,
    metrics: UsageMetrics,
    summary: AgentUsageSummary
  ) {
    const db = this.getDb();
    if (!db) return;

    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // A. 寫入細節日誌
      await db.collection('ai_usage_log').add({
        agent_id: agentId,
        model,
        ...metrics,
        timestamp: now.toISOString(),
      });

      // B. 更新匯總文檔 (按 Agent + Model + Date)
      const statsDocId = `${agentId}_${model.replace(/[:/]/g, '_')}_${dateStr}`;
      const statsRef = db.collection('ai_usage_stats').doc(statsDocId);
      
      await db.runTransaction(async (transaction: any) => {
        const doc = await transaction.get(statsRef);
        if (!doc.exists) {
          transaction.set(statsRef, {
            agent_id: agentId,
            model,
            date: dateStr,
            total_prompt_tokens: metrics.prompt_tokens,
            total_completion_tokens: metrics.completion_tokens,
            total_tokens: metrics.total_tokens,
            total_latency_ms: metrics.latency_ms,
            inference_count: 1,
            last_updated: now.toISOString(),
          });
        } else {
          const data = doc.data();
          transaction.update(statsRef, {
            total_prompt_tokens: data.total_prompt_tokens + metrics.prompt_tokens,
            total_completion_tokens: data.total_completion_tokens + metrics.completion_tokens,
            total_tokens: data.total_tokens + metrics.total_tokens,
            total_latency_ms: data.total_latency_ms + metrics.latency_ms,
            inference_count: data.inference_count + 1,
            last_updated: now.toISOString(),
          });
        }
      });
    } catch (err) {
      logger.warn(`[CostTracker] Failed to persist usage: ${err}`);
    }
  }

  /**
   * 取得所有匯總統計
   */
  public getAllStats(): AgentUsageSummary[] {
    return Array.from(this.summaries.values());
  }

  /**
   * 從 Firestore 初始化（可選，通常在啟動時執行）
   */
  public async initialize() {
    const db = this.getDb();
    if (!db) return;

    try {
      const snapshot = await db.collection('ai_usage_stats').get();
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        const key = `${data.agent_id}:${data.model}`;
        
        // 這裡簡單疊加，實際生產環境可能需要更精細的彙整
        let summary = this.summaries.get(key);
        if (!summary) {
          summary = {
            agent_id: data.agent_id,
            model: data.model,
            total_prompt_tokens: 0,
            total_completion_tokens: 0,
            total_tokens: 0,
            total_latency_ms: 0,
            inference_count: 0,
            last_used: data.last_updated,
          };
        }
        summary.total_prompt_tokens += data.total_prompt_tokens;
        summary.total_completion_tokens += data.total_completion_tokens;
        summary.total_tokens += data.total_tokens;
        summary.total_latency_ms += data.total_latency_ms;
        summary.inference_count += data.inference_count;
        this.summaries.set(key, summary);
      });
      logger.info(`[CostTracker] Initialized with ${this.summaries.size} metrics items`);
    } catch (err) {
      logger.warn(`[CostTracker] Initialization failed: ${err}`);
    }
  }
}

export const costTracker = new CostTracker();
