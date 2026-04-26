/**
 * Local Tool Parser Service
 *
 * Uses Ollama (local RTX 4080) to parse user intent and extract structured
 * tool call arguments — **without sending any data to cloud APIs**.
 *
 * This replaces Gemini Function Calling for all sensitive operations:
 *   - record_expense    → financial transactions
 *   - add_event         → personal schedule
 *   - record_weight     → personal health
 *   - record_fuel       → vehicle behavior
 *   - add_investment    → portfolio / trades
 *   - record_exercise   → health activity
 *   - record_sleep      → health data
 *   - get_schedule      → read today's schedule (local Firestore)
 *   - get_spending      → read monthly expenses (local Firestore)
 *   - get_portfolio     → read investment portfolio (local Firestore)
 *   - calculate_loan    → pure math, no PII
 *   - estimate_tax      → pure math, no PII
 *
 * Tools NOT handled here (cloud-side AI reasoning required):
 *   - get_financial_advice  → synthesized multi-domain analysis
 *
 * Privacy guarantee:
 *   If Ollama is offline, this function returns null and the caller should
 *   display an offline message — NOT fall back to Gemini. Sensitive data
 *   never leaves the local network.
 *
 * @module local-tool-parser.service
 */

import { logger } from 'firebase-functions/v2';
import { ollamaChat, OllamaUnavailableError, selectLocalModel } from './local-inference.service';

// ================================
// Types
// ================================

/** Subset of tool names that are resolved locally (sensitive data) */
export type LocalToolName =
    | 'record_expense'
    | 'record_weight'
    | 'record_exercise'
    | 'record_sleep'
    | 'add_event'
    | 'record_fuel'
    | 'add_investment'
    | 'get_schedule'
    | 'get_spending'
    | 'get_portfolio'
    | 'calculate_loan'
    | 'estimate_tax';

export interface LocalToolCall {
    name: LocalToolName;
    args: Record<string, unknown>;
}

/** Result from the local parser */
export interface LocalParseResult {
    toolCall: LocalToolCall | null;
    /** 'local' = parsed by Ollama, 'offline' = Ollama unavailable */
    source: 'local' | 'offline';
}

// ================================
// Intent Detection System Prompt
// ================================

function buildParserSystemPrompt(today: string): string {
    return `你是一個意圖解析器。分析用戶的訊息，判斷是否需要執行以下工具之一。
今天的日期是：${today}

只輸出一行 JSON，不要有任何說明文字、markdown 標記或多餘空白。

格式：
- 如果需要工具：{"tool":"工具名稱","args":{...}}
- 如果不需要工具（一般對話）：{"tool":null}

可用工具：

record_expense — 記錄一筆支出
  args: {"amount":數字, "description":"描述", "category":"餐飲|交通|購物|醫療|娛樂|日用品|其他"}
  觸發詞：花了、消費、買、付款、結帳、支出、刷卡、扣款、元、塊錢

add_event — 新增一筆行程
  args: {"title":"標題", "date":"YYYY-MM-DD", "startTime":"HH:MM（選填）"}
  觸發詞：新增行程、提醒我、排一個、約、開會、看診、下午幾點、明天幾點

record_weight — 記錄體重
  args: {"weight":數字（公斤）}
  觸發詞：體重、公斤、kg、今天幾公斤、量體重

record_exercise — 記錄運動
  args: {"type":"運動類型", "durationMinutes":分鐘數, "calories":卡路里（選填）}
  觸發詞：運動、跑步、騎車、游泳、健身、走路、爬山

record_sleep — 記錄睡眠
  args: {"hoursSlept":數字, "sleepQuality":"好|普通|差（選填）"}
  觸發詞：昨晚睡、睡了幾小時、睡眠

record_fuel — 記錄加油
  args: {"liters":公升數, "price_per_liter":每公升價格}
  觸發詞：加油、公升、每公升、油錢

add_investment — 記錄股票/ETF 買賣
  args: {"symbol":"代碼", "action":"buy|sell", "shares":股數, "price":價格}
  觸發詞：買了、賣了、進場、出場、股、ETF、股票

get_schedule — 查詢今日行程（無需 args）
  args: {}
  觸發詞：今天行程、我有什麼行程、今天有什麼事

get_spending — 查詢本月支出（無需 args）
  args: {}
  觸發詞：這個月花了多少、本月支出、這個月消費

get_portfolio — 查詢投資組合（無需 args）
  args: {}
  觸發詞：我的投資、持股、投資組合、倉位

calculate_loan — 貸款試算（純數學）
  args: {"principal":貸款金額, "annual_rate":年利率百分比, "term_months":期數}
  觸發詞：貸款、月付、利率計算、房貸試算

estimate_tax — 稅務估算（純數學）
  args: {"annual_salary":年薪, "investment_income":投資收入（選填）, "dependents":扶養人數（選填）}
  觸發詞：所得稅、稅務、報稅、稅率、綜所稅

如果訊息是一般問題、聊天、分析類請求，輸出：{"tool":null}
只輸出 JSON，不要任何其他文字。`;
}

// ================================
// Pattern Pre-filter (cheap check before Ollama call)
// ================================

/**
 * Quick regex pre-filter: returns true if the message likely contains
 * a tool-triggering intent. Avoids unnecessary Ollama calls for
 * clearly conversational messages.
 */
const TOOL_TRIGGER_PATTERNS: RegExp[] = [
    // Finance
    /花了|消費|買了|付款|結帳|支出|刷卡|扣款|元|塊錢|加油|公升/,
    // Schedule
    /新增行程|提醒我|排一個|開會|看診|下午\d|明天\d|後天/,
    // Health
    /體重|公斤|kg|運動|跑步|騎車|游泳|健身|睡了|昨晚睡/,
    // Investment
    /買了\d|賣了\d|進場|出場|ETF|股票.*\d/,
    // Query
    /今天行程|本月支出|這個月花|我的持股|投資組合|貸款試算|所得稅估算/,
];

export function mightContainToolIntent(message: string): boolean {
    return TOOL_TRIGGER_PATTERNS.some(p => p.test(message));
}

// ================================
// Main Parser
// ================================

/**
 * Attempt to parse a tool call from a user message using local Ollama.
 *
 * @returns `{ toolCall, source: 'local' }` if parsed successfully
 *          `{ toolCall: null, source: 'local' }` if no tool intent detected
 *          `{ toolCall: null, source: 'offline' }` if Ollama is unavailable
 */
export async function parseLocalToolCall(
    message: string,
    agentId: string = 'butler',
): Promise<LocalParseResult> {
    // Skip Ollama call if the message is clearly non-tool (performance optimization)
    if (!mightContainToolIntent(message)) {
        return { toolCall: null, source: 'local' };
    }

    const today = new Date().toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\//g, '-');

    const systemPrompt = buildParserSystemPrompt(today);
    const model = selectLocalModel(agentId);

    try {
        const raw = await ollamaChat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
            model,
            { temperature: 0.1, num_predict: 256 }, // low temp for deterministic JSON
        );

        // Strip any markdown fences Ollama might add (```json ... ```)
        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let parsed: { tool: LocalToolName | null; args?: Record<string, unknown> };
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            logger.warn(`[LocalToolParser] JSON parse failed, treating as no-tool. Raw: "${raw.slice(0, 200)}"`);
            return { toolCall: null, source: 'local' };
        }

        if (!parsed.tool) {
            logger.info(`[LocalToolParser] No tool intent detected for message: "${message.slice(0, 60)}"`);
            return { toolCall: null, source: 'local' };
        }

        const toolCall: LocalToolCall = {
            name: parsed.tool,
            args: parsed.args || {},
        };

        logger.info(`[LocalToolParser] ✅ Parsed tool=${toolCall.name} args=${JSON.stringify(toolCall.args)} via local/${model}`);
        return { toolCall, source: 'local' };

    } catch (err) {
        if (err instanceof OllamaUnavailableError) {
            logger.warn(`[LocalToolParser] Ollama offline — sensitive tool ops blocked. Reason: ${err.message}`);
            return { toolCall: null, source: 'offline' };
        }
        // Unexpected error — treat as no-tool to avoid crashing
        logger.error('[LocalToolParser] Unexpected error during parse:', err);
        return { toolCall: null, source: 'local' };
    }
}

// ================================
// Sensitive Tool Check
// ================================

/** Tools that contain PII / sensitive personal data */
const SENSITIVE_TOOLS = new Set<LocalToolName>([
    'record_expense',
    'record_weight',
    'record_exercise',
    'record_sleep',
    'add_event',
    'record_fuel',
    'add_investment',
    'get_schedule',
    'get_spending',
    'get_portfolio',
]);

/**
 * Returns true if the given tool name should NEVER be sent to a cloud API.
 */
export function isSensitiveTool(toolName: string): boolean {
    return SENSITIVE_TOOLS.has(toolName as LocalToolName);
}
