/**
 * Training Logger Service
 *
 * 知識蒸餾管線 (Knowledge Distillation Pipeline)
 * ─────────────────────────────────────────────────────
 * 每次 Gemini (cloud) �?Ollama (local) 回應後，同時記錄�? *
 *   1. Firestore `training_logs`
 *      - 包含 Ollama 標準 JSONL 格式 (messages array)
 *      - 可直�?export �?`ollama create <model> --file training.jsonl`
 *      - 可用�?LoRA / QLoRA 微調 qwen3:14b / gpt-oss:20b
 *
 *   2. ChromaDB `training_knowledge` collection
 *      - 向量索引，即時可�?RAG 查詢
 *      - 讓本地模型在下次回答時能「知道」Gemini 曾怎麼回答
 *
 * 寫入策略：Fire-and-forget (不阻塞主回應流程)
 */
export type TrainingSource = 'gemini-2.0-flash' | 'ollama-local' | 'gemini-fallback';
export interface TrainingRecord {
    /** 呼叫 AI �?user ID */
    userId: string;
    /** 當前 agent (butler / investment / engineering �? */
    agent: string;
    /** 使用的模�?*/
    model: string;
    /** 來源：雲�?Gemini 或本�?Ollama */
    source: TrainingSource;
    /** 使用者原始訊�?*/
    userMessage: string;
    /** 系統 prompt (agent 角色定義) */
    systemPrompt: string;
    /** AI 最終回�?*/
    response: string;
    /** 是否需要即時資�?(決定路由的關�? */
    requiresLiveData: boolean;
    /** 觸發的工具呼�?(若有) */
    toolCalls?: Array<{
        name: string;
        args: Record<string, unknown>;
    }>;
}
/**
 * 記錄一筆訓練資料�? * Fire-and-forget �?呼叫方不需 await�? *
 * 寫入�? *   - Firestore: `training_logs/{autoId}`  (�?Ollama JSONL 格式)
 *   - ChromaDB : `training_knowledge`       (向量索引，RAG 可查)
 */
export declare function recordTrainingData(record: TrainingRecord): Promise<void>;
/**
 * �?Firestore 匯出指定條件的訓練資料，格式化為 JSONL 字串�? *
 * 使用方法�? *   const jsonl = await exportTrainingJSONL({ source: 'gemini-2.0-flash', limit: 500 });
 *   fs.writeFileSync('training.jsonl', jsonl);
 *   // 然後：ollama create xxt-butler:v1 --file Modelfile
 *
 * @param opts.source      過濾來源 (不填 = 全部)
 * @param opts.agent       過濾 agent (不填 = 全部)
 * @param opts.limit       最多幾�?(預設 1000)
 * @param opts.onlyExported 僅匯出尚未標記匯出的 (預設 false)
 */
export declare function exportTrainingJSONL(opts?: {
    source?: TrainingSource;
    agent?: string;
    limit?: number;
    markAsExported?: boolean;
}): Promise<string>;
//# sourceMappingURL=training-logger.service.d.ts.map