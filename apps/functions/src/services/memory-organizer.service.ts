/**
 * Memory Organizer Service — Local-First Memory Intelligence
 *
 * 三層記憶自動整理系統，全程在本地 Ollama (RTX 4080) 執行：
 *
 *   Layer A — 對話後萃取 (extractAndSaveFacts)
 *     每次對話結束後，讓 Ollama 從對話中萃取 fact / preference，
 *     自動寫入 ChromaDB，無需用戶明確觸發。
 *
 *   Layer B — 每日摘要 (runDailySummary)
 *     Cloud Scheduler 每日凌晨 2:00 觸發。
 *     彙整當日財務、健康、行程，產生結構化日報存入長期記憶。
 *
 *   Layer C — 跨域關聯洞察 (runCrossdomainInsights)
 *     每週日觸發，Ollama 觀察多個維度的關聯，
 *     主動產生行為洞察（如「加班日的消費習慣」）。
 *
 * 所有操作離線時靜默降級，不影響主流程。
 */

import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ollamaGenerate, isOllamaAvailable } from './local-inference.service';
import { saveMemory } from './memory-store.service';

const db = getFirestore();

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface ExtractedFact {
    type: 'fact' | 'preference';
    content: string;
    importance: 1 | 2 | 3 | 4 | 5;
    tags: string[];
}

export interface DailySummaryResult {
    userId: string;
    date: string;
    factsExtracted: number;
    summariesSaved: number;
    insightsGenerated: number;
    skippedReason?: string;
}

// ─────────────────────────────────────────
// Layer A — 對話後事實萃取
// ─────────────────────────────────────────

const EXTRACT_SYSTEM_PROMPT = `你是記憶萃取器。從以下對話中提取值得長期記憶的事實和偏好。

只輸出 JSON 陣列，格式：
[
  {"type":"fact","content":"用戶不喜歡辛辣食物","importance":3,"tags":["飲食","健康"]},
  {"type":"preference","content":"用戶偏好早上運動","importance":2,"tags":["運動","習慣"]}
]

規則：
- type: "fact"（客觀事實）或 "preference"（個人偏好/習慣）
- importance: 1=無關緊要, 3=有用, 5=非常重要
- 如果沒有值得記憶的內容，回傳空陣列 []
- 忽略一般閒聊，只提取有長期價值的資訊
- 不要提取已記錄的財務/健康數字（那些由工具直接存）
- 只輸出 JSON，不要有任何說明文字`;

/**
 * Layer A: 從單次對話萃取事實/偏好並存入記憶
 * 在 butler-ai.service.ts 回應後非同步呼叫（不阻塞回應）
 */
export async function extractAndSaveFacts(
    userId: string,
    agentId: string,
    userMessage: string,
    assistantReply: string,
): Promise<number> {
    if (!await isOllamaAvailable()) {
        logger.info('[MemoryOrganizer-A] Ollama offline, skip extraction');
        return 0;
    }

    const conversation = `用戶：${userMessage}\n助理：${assistantReply}`;

    try {
        const raw = await ollamaGenerate(
            conversation,
            EXTRACT_SYSTEM_PROMPT,
            'qwen3:14b',
            { temperature: 0.2, num_predict: 512 },
        );

        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let facts: ExtractedFact[];
        try {
            facts = JSON.parse(cleaned);
            if (!Array.isArray(facts)) facts = [];
        } catch {
            logger.info('[MemoryOrganizer-A] No extractable facts in this turn');
            return 0;
        }

        if (facts.length === 0) return 0;

        // 過濾低重要性條目（importance < 2 不值得寫入）
        const valuable = facts.filter(f => f.importance >= 2);

        await Promise.all(
            valuable.map(f =>
                saveMemory({
                    userId,
                    agentId,
                    content: f.content,
                    type: f.type,
                    importance: f.importance,
                    tags: f.tags,
                })
            )
        );

        logger.info(`[MemoryOrganizer-A] Saved ${valuable.length} facts for user=${userId}`);
        return valuable.length;

    } catch (err) {
        logger.warn('[MemoryOrganizer-A] extractAndSaveFacts failed (graceful):', err instanceof Error ? err.message : err);
        return 0;
    }
}

// ─────────────────────────────────────────
// Layer B — 每日摘要
// ─────────────────────────────────────────

/**
 * 從 Firestore 讀取當日各類資料，彙整成摘要
 */
async function buildDailyContext(userId: string, dateStr: string): Promise<string> {
    const todayStart = new Date(`${dateStr}T00:00:00+08:00`);
    const todayEnd = new Date(`${dateStr}T23:59:59+08:00`);

    const sections: string[] = [];

    try {
        // 財務
        const finSnap = await db.collection(`users/${userId}/finance_transactions`)
            .where('date', '>=', Timestamp.fromDate(todayStart))
            .where('date', '<=', Timestamp.fromDate(todayEnd))
            .limit(50)
            .get();

        if (!finSnap.empty) {
            const items = finSnap.docs.map(d => {
                const data = d.data();
                return `- ${data.description || '未命名'} $${data.amount} (${data.category || '未分類'})`;
            });
            sections.push(`【今日支出 ${items.length} 筆】\n${items.join('\n')}`);
        }

        // 健康
        const healthSnap = await db.collection(`users/${userId}/health_records`)
            .where('timestamp', '>=', Timestamp.fromDate(todayStart))
            .limit(10)
            .get();

        if (!healthSnap.empty) {
            const items = healthSnap.docs.map(d => {
                const data = d.data();
                const parts: string[] = [];
                if (data.weight) parts.push(`體重 ${data.weight}kg`);
                if (data.steps) parts.push(`步數 ${data.steps}`);
                if (data.exerciseMinutes) parts.push(`運動 ${data.exerciseMinutes} 分鐘`);
                if (data.sleepHours) parts.push(`睡眠 ${data.sleepHours} 小時`);
                return parts.join('、');
            }).filter(Boolean);
            if (items.length > 0) {
                sections.push(`【今日健康記錄】\n${items.join('\n')}`);
            }
        }

        // 行程
        const calSnap = await db.collection(`users/${userId}/calendar_events`)
            .where('startTime', '>=', Timestamp.fromDate(todayStart))
            .where('startTime', '<=', Timestamp.fromDate(todayEnd))
            .limit(20)
            .get();

        if (!calSnap.empty) {
            const items = calSnap.docs.map(d => {
                const data = d.data();
                return `- ${data.title || '未命名'}`;
            });
            sections.push(`【今日行程 ${items.length} 項】\n${items.join('\n')}`);
        }

    } catch (err) {
        logger.warn('[MemoryOrganizer-B] buildDailyContext read error:', err instanceof Error ? err.message : err);
    }

    return sections.join('\n\n');
}

const DAILY_SUMMARY_PROMPT = `你是個人日報產生器。根據以下今日資料，產生一段簡潔的日報摘要（100-200字繁體中文）。

重點：
1. 支出趨勢（有無超出預算？異常消費？）
2. 健康狀況（達標？需要注意？）
3. 行程完成度
4. 一個具體的改善建議

只輸出摘要內容，不要標題或標籤。`;

/**
 * Layer B: 每日摘要（Cloud Scheduler 呼叫）
 */
export async function runDailySummary(userIds: string[]): Promise<DailySummaryResult[]> {
    const results: DailySummaryResult[] = [];

    if (!await isOllamaAvailable()) {
        logger.warn('[MemoryOrganizer-B] Ollama offline, skip daily summary');
        return userIds.map(userId => ({
            userId,
            date: todayString(),
            factsExtracted: 0,
            summariesSaved: 0,
            insightsGenerated: 0,
            skippedReason: 'ollama_offline',
        }));
    }

    for (const userId of userIds) {
        const date = todayString();
        const result: DailySummaryResult = {
            userId,
            date,
            factsExtracted: 0,
            summariesSaved: 0,
            insightsGenerated: 0,
        };

        try {
            const context = await buildDailyContext(userId, date);
            if (!context.trim()) {
                result.skippedReason = 'no_data_today';
                results.push(result);
                continue;
            }

            const summary = await ollamaGenerate(
                context,
                DAILY_SUMMARY_PROMPT,
                'qwen3:14b',
                { temperature: 0.4, num_predict: 400 },
            );

            if (summary.trim().length > 20) {
                await saveMemory({
                    userId,
                    agentId: 'butler',
                    content: `[日報 ${date}] ${summary.trim()}`,
                    summary: `${date} 自動日報`,
                    type: 'fact',
                    importance: 3,
                    tags: ['日報', '自動摘要', date],
                });
                result.summariesSaved = 1;
            }

        } catch (err) {
            logger.error(`[MemoryOrganizer-B] Daily summary failed for ${userId}:`, err);
            result.skippedReason = 'error';
        }

        results.push(result);
    }

    logger.info('[MemoryOrganizer-B] Daily summary complete', { count: results.length });
    return results;
}

// ─────────────────────────────────────────
// Layer C — 跨域關聯洞察
// ─────────────────────────────────────────

const INSIGHT_SYSTEM_PROMPT = `你是行為洞察分析師。分析以下7天的記憶摘要，找出有趣的跨域關聯。

輸出格式（JSON 陣列，最多 3 條洞察）：
[
  {"insight":"你在週五晚上的餐飲支出比平均高 60%，可能與加班有關","tags":["消費","工作","習慣"],"importance":3}
]

只輸出 JSON，不要說明文字。`;

/**
 * Layer C: 跨域關聯洞察（每週執行）
 */
export async function runCrossdomainInsights(userId: string): Promise<number> {
    if (!await isOllamaAvailable()) {
        logger.info('[MemoryOrganizer-C] Ollama offline, skip insights');
        return 0;
    }

    try {
        // 讀取最近 7 天的日報記憶
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const snap = await db.collection(`users/${userId}/memories`)
            .where('type', '==', 'fact')
            .where('createdAt', '>=', weekAgo)
            .orderBy('createdAt', 'desc')
            .limit(30)
            .get();

        if (snap.empty) {
            logger.info(`[MemoryOrganizer-C] No recent memories for ${userId}`);
            return 0;
        }

        const recentMemories = snap.docs
            .map(d => d.data().content as string)
            .filter(Boolean)
            .join('\n');

        const raw = await ollamaGenerate(
            recentMemories,
            INSIGHT_SYSTEM_PROMPT,
            'qwen3:14b',
            { temperature: 0.6, num_predict: 512 },
        );

        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let insights: Array<{ insight: string; tags: string[]; importance: number }>;
        try {
            insights = JSON.parse(cleaned);
            if (!Array.isArray(insights)) insights = [];
        } catch {
            return 0;
        }

        let saved = 0;
        for (const item of insights.slice(0, 3)) {
            if (!item.insight || item.insight.trim().length < 10) continue;
            await saveMemory({
                userId,
                agentId: 'butler',
                content: `[週洞察] ${item.insight}`,
                type: 'fact',
                importance: (item.importance as 1 | 2 | 3 | 4 | 5) || 3,
                tags: [...(item.tags || []), '週洞察', '自動分析'],
            });
            saved++;
        }

        logger.info(`[MemoryOrganizer-C] Saved ${saved} insights for user=${userId}`);
        return saved;

    } catch (err) {
        logger.warn('[MemoryOrganizer-C] runCrossdomainInsights failed:', err instanceof Error ? err.message : err);
        return 0;
    }
}

// ─────────────────────────────────────────
// 取得所有活躍用戶 (Scheduler 用)
// ─────────────────────────────────────────

/**
 * 取得最近 7 天有活動的用戶 ID 列表
 */
export async function getActiveUserIds(): Promise<string[]> {
    try {
        const weekAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const snap = await db.collection('users')
            .where('lastActive', '>=', weekAgo)
            .limit(100)
            .get();

        return snap.docs.map(d => d.id);
    } catch (err) {
        logger.warn('[MemoryOrganizer] getActiveUserIds failed:', err instanceof Error ? err.message : err);
        return [];
    }
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function todayString(): string {
    return new Date().toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\//g, '-');
}
