/**
 * Butler AI Service
 * 
 * Provides intelligent response generation for the Personal Butler
 * using Gemini AI or OpenAI GPT with fallback to keyword matching.
 */

import { logger } from 'firebase-functions/v2';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getSecret } from '../config/secrets';
import { getButlerContext } from './butler-data.service';
import { sanitizeForAI, sanitizeAIOutput } from '../utils/ai-sanitizer';
import { routedChat } from './inference-router.service';
import { parseLocalToolCall, isSensitiveTool } from './local-tool-parser.service';
import { extractAndSaveFacts } from './memory-organizer.service';

let geminiClient: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

// Available AI models
export type AIModel = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gpt-4o' | 'gpt-4o-mini';

/**
 * Pre-warm AI clients to reduce cold start latency (V3 #25)
 * Call from health endpoint or global init to eagerly initialize.
 */
export async function preWarmAIClients(): Promise<{ gemini: boolean; openai: boolean }> {
    const result = { gemini: false, openai: false };
    try {
        await getGeminiClient();
        result.gemini = true;
    } catch { /* silent */ }
    try {
        await getOpenAIClient();
        result.openai = true;
    } catch { /* silent */ }
    logger.info('[Butler AI] Pre-warm complete', result);
    return result;
}

// Butler persona and capabilities
const BUTLER_SYSTEM_PROMPT = `你是「小秘書」，一個專業的個人智能管家助理。

## 你的角色
- 友善、專業、高效的個人助理
- 熟悉用戶的日常需求：行程、財務、車輛、健康、工作

## 回應風格
- 使用繁體中文
- 簡潔明瞭，不囉嗦
- 適時使用 emoji 增加親切感
- 主動提供有用建議

## 你能處理的領域
1. 📋 行程管理 - 查詢/新增行程、設定提醒
2. 💰 財務追蹤 - 支出統計、預算提醒
3. 📈 投資理財 - 投資組合追蹤、買賣記錄、資產配置分析
4. 🏦 貸款管理 - 貸款追蹤、還款試算、再融資建議
5. 📋 稅務估算 - 所得稅試算、股利節稅、扣除項建議
6. 🤖 理財顧問 - 綜合財務分析、退休規劃、個人化建議
7. 🚗 車輛管理 - Jimny JB74 保養、油耗追蹤
8. 🏃 健康記錄 - 運動、睡眠、體重追蹤
9. 🏢 工作管理 - 專案狀態、客戶追蹤

## 回應格式
- 對於查詢類請求，提供清晰的狀態摘要
- 對於操作類請求，確認操作並提供下一步建議
- 如果無法處理，友善地說明並提供替代方案

請根據用戶訊息提供適當的回應。`;

const AGENT_PROMPTS: Record<string, string> = {
    'butler': BUTLER_SYSTEM_PROMPT,
    'titan': `你是「Titan」，BIM與建築工程專家 Agent。
你隸屬於 XXT-AGENT 團隊的工程與空間設計部門。
專精於建築資訊模型 (BIM)、結構設計、營建管理與圖面審查。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣專業、精準、務實。
- 適時使用專業術語，但能為非專業人士提供白話解釋。

## 你能處理的領域
1. 🏗️ 建築法規與結構分析
2. 📐 BIM 模型規劃與衝突檢討
3. 📋 施工進度與排程建議
4. 🏢 智慧建築與永續設計 (LEED/EEWH)`,
    'lumi': `你是「Lumi」，室內設計與空間規劃專家 Agent。
你隸屬於 XXT-AGENT 團隊的工程與空間設計部門。
專精於室內設計、動線規劃、材質搭配與光影設計。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣優雅、有美感、具啟發性。
- 專注於使用者體驗與美學細節。

## 你能處理的領域
1. 🎨 空間風格與色彩計畫
2. 🛋️ 傢俱配置與動線規劃
3. 💡 照明設計與情境設定
4. 🌿 軟裝佈置與綠化建議`,
    'rusty': `你是「Rusty」，數量估算與成本控制專家 (Quantity Surveyor) Agent。
你隸屬於 XXT-AGENT 團隊的工程與空間設計部門。
專精於工程算圖、成本分析、發包預算與物料管理。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣嚴謹、數字導向、精打細算。
- 專注於預算控制與成本效益。

## 你能處理的領域
1. 💰 裝修與工程預算估算
2. 📊 數量計算與單價分析
3. 📝 發包文件與合約審查
4. 📉 價值工程與成本優化`,
    'accountant': `你是「Accountant」(會計)，專屬的財務與稅務專家 Agent。
專精於帳務管理、稅務規劃、報表分析與企業財務。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣專業、謹慎、條理分明。
- 專注於合規性與財務健康。

## 你能處理的領域
1. 📊 財務報表分析與記帳
2. 🏛️ 營業稅與營所稅試算
3. 💼 企業與個人節稅建議
4. 💵 現金流與預算管理`,
    'argus': `你是「Argus」，網路安全與情報分析專家 Agent。
專精於資安防護、威脅情報、開源情報 (OSINT) 與系統監控。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣冷靜、警覺、注重安全。
- 回答精煉，直指核心風險。

## 你能處理的領域
1. 🛡️ 系統安全與漏洞評估
2. 🔍 開源情報蒐集與分析
3. 🚨 異常行為與威脅監控
4. 🔐 隱私保護與加密建議`,
    'nova': `你是「Nova」，人力資源與營運管理專家 Agent。
專精於招募流程、績效管理、組織文化與行政營運。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣溫和、具同理心、富有組織能力。
- 專注於團隊協作與人才發展。

## 你能處理的領域
1. 👥 招募規劃與面試建議
2. 📈 績效評估與回饋機制
3. 🏢 企業文化與員工體驗
4. 📅 內部營運與行政流程`,
    'investment': `你是「Investment」，量化投資與市場分析專家 Agent。
專精於總體經濟分析、量化交易策略、資產配置與風險管理。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣果斷、數據驅動、客觀理性。
- 專注於投資報酬率與風險控制。

## 你能處理的領域
1. 📈 股市與加密貨幣趨勢分析
2. 🤖 量化交易與演算法策略
3. 💼 投資組合最佳化與再平衡
4. ⚠️ 市場風險評估與避險建議`,
    'forge': `你是「Forge」，製造與機電整合專家 Agent。
你隸屬於 XXT-AGENT 團隊的硬體與製造部門。
專精於小型化/家用 CNC、3D 列印機構設計、以及軟韌體 (Firmware/Software) 開發整合。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣充滿實作精神、精確、工程導向。
- 注重可製造性 (DFM) 與軟硬體整合的實務細節。

## 你能處理的領域
1. ⚙️ 機構設計與 3D 列印/CNC 加工建議
2. 💻 步進馬達、感測器與微控制器韌體開發
3. 🛠️ G-Code 最佳化與機台參數調校
4. 🔌 系統整合與自動化控制`,
    'matter': `你是「Matter」，材料科學與應用分析專家 Agent。
你隸屬於 XXT-AGENT 團隊的硬體與製造部門。
專精於金屬加工、聚合物 (PLA/ABS/PETG/樹脂) 及複合材料的物理特性與應用領域分析。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣嚴謹、科學、具實驗精神。
- 專注於材料特性、成本效益與結構強度分析。

## 你能處理的領域
1. 🔬 材料物理與化學特性分析
2. 🧪 3D 列印與 CNC 加工材料選用建議
3. 📐 結構強度與耐用性評估
4. 💲 材料成本與生產效益分析`,
    'nexus': `你是「Nexus」，系統整合與架構專家 Agent。
專精於雲端架構、微服務設計、DevOps 流程與系統擴展性規劃。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣結構化、前瞻性、注重系統思維。
- 提供全域視角的技術建議。

## 你能處理的領域
1. ☁️ 雲端與基礎設施架構設計
2. 🔄 CI/CD 與自動化部署流程
3. 🔗 跨系統 API 整合與微服務
4. 📈 系統效能優化與高可用性規劃`,
    'zenith': `你是「Zenith」，永續發展與 ESG 專家 Agent。
專精於企業碳盤查、ESG 報告、綠色供應鏈與永續策略規劃。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣具社會責任感、長遠規劃、數據佐證。
- 著重於環境與商業價值的平衡。

## 你能處理的領域
1. 🌍 ESG 策略與永續報告書編製
2. ♻️ 碳足跡盤查與減碳路徑規劃
3. 🍃 綠色能源與循環經濟導入
4. 📜 永續法規與合規性輔導`,
    'apex': `你是「Apex」，行銷與業務拓展專家 Agent。
專精於品牌策略、數位行銷、成長駭客 (Growth Hacking) 與市場分析。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣充滿活力、具說服力、以結果為導向。
- 注重轉換率、用戶心理與市場動態。

## 你能處理的領域
1. 🎯 市場定位與品牌策略規劃
2. 📊 數位行銷與廣告投放優化
3. 💼 B2B/B2C 業務拓展與合作洽談
4. 📈 用戶成長與留存策略設計`,
    'vertex': `你是「Vertex」，法務與合規專家 Agent。
專精於企業法規、合約審查、智財權保護與風險管控。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣嚴謹、客觀、注重風險防範。
- 條理清晰地列出法律風險與建議。

## 你能處理的領域
1. ⚖️ 商業合約與保密協議審查
2. 🛡️ 智慧財產權與商標保護
3. 📋 勞資關係與企業內部規範
4. 🚨 法規遵循與潛在風險評估`,
    'echo': `你是「Echo」，公關與客服專家 Agent。
專精於品牌公關、危機處理、客戶體驗與媒體關係。

## 回應風格
- 務必使用**繁體中文**回答。
- 語氣具同理心、圓滑、善於溝通。
- 注重品牌形象與客戶滿意度。

## 你能處理的領域
1. 🗣️ 新聞稿撰寫與媒體關係維護
2. 🆘 品牌公關危機處理與聲明
3. 🤝 客戶服務與滿意度提升計畫
4. 📱 社群互動與品牌聲量分析`
};

export function getAgentPrompt(agentId?: string): string {
    return AGENT_PROMPTS[agentId || 'butler'] || AGENT_PROMPTS['butler'];
}

/**
 * Initialize Gemini client
 */
async function getGeminiClient(): Promise<GoogleGenerativeAI> {
    if (geminiClient) return geminiClient;
    try {
        const apiKey = await getSecret('GEMINI_API_KEY');
        geminiClient = new GoogleGenerativeAI(apiKey);
        logger.info('[Butler AI] Gemini client initialized');
        return geminiClient;
    } catch (err) {
        logger.error('[Butler AI] Failed to get Gemini API key:', err);
        throw new Error('Gemini API key not available');
    }
}

/**
 * Initialize OpenAI client
 */
async function getOpenAIClient(): Promise<OpenAI> {
    if (openaiClient) return openaiClient;
    try {
        const apiKey = await getSecret('OPENAI_API_KEY');
        openaiClient = new OpenAI({ apiKey });
        logger.info('[Butler AI] OpenAI client initialized');
        return openaiClient;
    } catch (err) {
        logger.error('[Butler AI] Failed to get OpenAI API key:', err);
        throw new Error('OpenAI API key not available');
    }
}

/**
 * Generate AI response using Gemini
 */
async function generateGeminiResponse(
    userMessage: string,
    model: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite',
    systemPrompt: string,
    contextPrompt: string
): Promise<string> {
    const client = await getGeminiClient();
    const geminiModel = client.getGenerativeModel({ model });

    const result = await geminiModel.generateContent([
        { text: systemPrompt + contextPrompt },
        { text: `用戶訊息：${userMessage}` },
    ]);

    return result.response.text();
}

/**
 * Generate AI response using OpenAI GPT
 */
async function generateOpenAIResponse(
    userMessage: string,
    model: 'gpt-4o' | 'gpt-4o-mini',
    systemPrompt: string,
    contextPrompt: string
): Promise<string> {
    const client = await getOpenAIClient();

    const completion = await client.chat.completions.create({
        model: model,
        messages: [
            { role: 'system', content: systemPrompt + contextPrompt },
            { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '抱歉，我無法產生回應。';
}

/**
 * Generate AI response for user message
 * 
 * Routing strategy (Local-First):
 *   1. Classify task → local-safe vs cloud-required
 *   2. Local-safe  → Ollama on RTX 4080 (zero token cost)
 *   3. Cloud-required or Ollama offline → Gemini / OpenAI (fallback)
 */
export async function generateAIResponse(
    userMessage: string,
    userId?: string,
    context?: {
        previousMessages?: string[];
        userProfile?: Record<string, unknown>;
        model?: AIModel;
        activeAgent?: string;
    }
): Promise<string> {
    const activeAgent = context?.activeAgent || 'butler';
    const systemPrompt = getAgentPrompt(activeAgent);

    // Sanitize input (V3 #9 — prompt injection guard)
    const sanitized = sanitizeForAI(userMessage);
    const safeMessage = sanitized.text;

    try {
        // Build conversation context string (for cloud fallback)
        let contextPrompt = '';
        if (context?.previousMessages?.length) {
            contextPrompt = '\n\n最近的對話：\n' + context.previousMessages.slice(-3).join('\n');
        }

        // Fetch personalized data from Firestore (shared by local + cloud paths)
        if (userId) {
            try {
                const personalData = await getButlerContext(userId);
                if (personalData.health) {
                    contextPrompt += `\n\n## 用戶健康數據\n${JSON.stringify(personalData.health, null, 2)}`;
                }
                if (personalData.finance) {
                    contextPrompt += `\n\n## 用戶財務摘要\n${JSON.stringify(personalData.finance, null, 2)}`;
                }
                if (personalData.vehicle) {
                    contextPrompt += `\n\n## 用戶車輛資訊\n${JSON.stringify(personalData.vehicle, null, 2)}`;
                }
                if (personalData.calendar) {
                    contextPrompt += `\n\n## 用戶今日行程\n${JSON.stringify(personalData.calendar, null, 2)}`;
                }
            } catch (dataErr) {
                logger.warn('[Butler AI] Failed to fetch personal data, proceeding without:', dataErr);
            }
        }

        // ── Local-First Routing ─────────────────────────────────────────────
        // Cloud fallback closure: called only if Ollama is unavailable or task
        // requires live data (market prices, news, OCR, etc.)
        const cloudFallback = async (): Promise<string> => {
            const selectedModel = context?.model || 'gemini-2.5-flash';
            if (selectedModel.startsWith('gpt')) {
                return generateOpenAIResponse(
                    safeMessage,
                    selectedModel as 'gpt-4o' | 'gpt-4o-mini',
                    systemPrompt,
                    contextPrompt
                );
            }
            return generateGeminiResponse(
                safeMessage,
                selectedModel as 'gemini-2.5-flash' | 'gemini-2.5-flash-lite',
                systemPrompt,
                contextPrompt
            );
        };

        const result = await routedChat(
            safeMessage,
            activeAgent,
            context?.previousMessages || [],
            cloudFallback
        );

        logger.info(
            `[Butler AI] Response via ${result.backend}/${result.model} ` +
            `for user=${userId || 'unknown'} agent=${activeAgent}`
        );

        return sanitizeAIOutput(result.text);

    } catch (err) {
        logger.error('[Butler AI] AI generation failed, using keyword fallback:', err);
        return generateFallbackResponse(userMessage);
    }
}

/**
 * Fallback keyword-based response when AI fails
 */
function generateFallbackResponse(text: string): string {
    const lowerText = text.toLowerCase();

    // 行程相關
    if (lowerText.includes('行程') || lowerText.includes('今天') || lowerText.includes('schedule')) {
        return `📅 今日行程

目前沒有排定的行程。

💡 您可以說「新增行程 [時間] [內容]」來建立行程。`;
    }

    // 財務相關
    if (lowerText.includes('支出') || lowerText.includes('花費') || lowerText.includes('財務') || lowerText.includes('錢')) {
        return `💰 財務概況

📊 本月支出統計功能正在建設中...

💡 您可以使用 Butler API 來記錄交易。`;
    }

    // 車輛相關
    if (lowerText.includes('車') || lowerText.includes('保養') || lowerText.includes('加油') || lowerText.includes('jimny')) {
        return `🚗 Jimny JB74 狀態

⛽ 油耗追蹤：等待數據輸入
🔧 下次保養：請先記錄里程

💡 告訴我您的里程數來計算下次保養時間。`;
    }

    // 健康相關
    if (lowerText.includes('健康') || lowerText.includes('運動') || lowerText.includes('體重') || lowerText.includes('步數') || lowerText.includes('今日健康')) {
        return `🏃 健康狀態

📊 健康數據同步功能準備中...

🎯 建議目標：
• 每日步數：8,000 步
• 活動時間：30 分鐘
• 睡眠時間：7 小時

💡 可連接 Apple Watch 或 Garmin 同步數據`;
    }

    // 工作相關
    if (lowerText.includes('專案') || lowerText.includes('工作') || lowerText.includes('客戶') || lowerText.includes('project') || lowerText.includes('業務')) {
        return `🏢 業務概況

📋 活躍專案：0
💰 待收款項：NT$0

💡 使用 Butler API 管理您的專案和客戶。`;
    }

    // 幫助
    if (lowerText.includes('幫助') || lowerText.includes('help') || lowerText.includes('功能')) {
        return `👋 小秘書功能說明

我可以幫助您管理：
📋 行程 - 「今天行程」「新增行程」
💰 財務 - 「這個月支出」「記帳」
🚗 愛車 - 「保養提醒」「加油記錄」
🏃 健康 - 「今日健康」「運動記錄」
🏢 工作 - 「專案狀態」「客戶追蹤」

直接輸入您的需求，我會盡力為您服務！`;
    }

    // 預設回應
    return `👋 您好！我是小秘書。

我聽到您說：「${text}」

您可以試試：
• 「今天行程」查看日程
• 「這個月支出」查看財務
• 「幫助」查看所有功能

有什麼我可以幫您的嗎？`;
}

/**
 * Check if AI service is available
 */
export async function isAIAvailable(model?: AIModel): Promise<boolean> {
    try {
        if (model?.startsWith('gpt')) {
            await getOpenAIClient();
        } else {
            await getGeminiClient();
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Get available AI models
 */
export function getAvailableModels(): AIModel[] {
    return ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gpt-4o', 'gpt-4o-mini'];
}

// ================================
// Gemini Function Calling (Tool Use)
// ================================

// Use string literals instead of SchemaType enum to avoid runtime failures
// when @google/generative-ai module is partially loaded in test environments.
// The Gemini API accepts both enum values and string literals.

/**
 * Tool definitions for Gemini function calling.
 * These allow the AI to autonomously determine when to execute actions.
 */
const BUTLER_TOOLS = [
    {
        functionDeclarations: [
            {
                name: 'record_expense',
                description: '記錄一筆支出到用戶的財務記錄',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        amount: { type: 'NUMBER' as const, description: '金額' },
                        description: { type: 'STRING' as const, description: '描述（例如午餐、加油）' },
                        category: { type: 'STRING' as const, description: '分類：餐飲/交通/購物/醫療/娛樂/日用品/其他' },
                    },
                    required: ['amount', 'description'],
                },
            },
            {
                name: 'record_weight',
                description: '記錄用戶的體重',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        weight: { type: 'NUMBER' as const, description: '體重（公斤）' },
                    },
                    required: ['weight'],
                },
            },
            {
                name: 'add_event',
                description: '新增一個行程到日曆',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        title: { type: 'STRING' as const, description: '事件標題' },
                        date: { type: 'STRING' as const, description: '日期（YYYY-MM-DD）' },
                        time: { type: 'STRING' as const, description: '時間（HH:mm）' },
                    },
                    required: ['title', 'date'],
                },
            },
            {
                name: 'get_schedule',
                description: '查詢用戶的行程',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        date: { type: 'STRING' as const, description: '要查詢的日期（YYYY-MM-DD），空白表示今天' },
                    },
                },
            },
            {
                name: 'get_spending',
                description: '查詢用戶的支出摘要',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        month: { type: 'NUMBER' as const, description: '月份（1-12），空白表示本月' },
                    },
                },
            },
            {
                name: 'record_fuel',
                description: '記錄車輛加油',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        liters: { type: 'NUMBER' as const, description: '公升數' },
                        price_per_liter: { type: 'NUMBER' as const, description: '每公升價格' },
                    },
                    required: ['liters'],
                },
            },
            {
                name: 'add_investment',
                description: '記錄投資交易（買入/賣出股票、ETF）',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        symbol: { type: 'STRING' as const, description: '股票代號（如 2330、0050、AAPL）' },
                        action: { type: 'STRING' as const, description: '操作：buy 或 sell' },
                        shares: { type: 'NUMBER' as const, description: '股數' },
                        price: { type: 'NUMBER' as const, description: '每股價格' },
                    },
                    required: ['symbol', 'action', 'shares', 'price'],
                },
            },
            {
                name: 'get_portfolio',
                description: '查詢投資組合總覽（持倉、損益、配置）',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {},
                },
            },
            {
                name: 'calculate_loan',
                description: '貸款月付試算（等額本息）',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        principal: { type: 'NUMBER' as const, description: '貸款金額' },
                        annual_rate: { type: 'NUMBER' as const, description: '年利率（%）' },
                        term_months: { type: 'NUMBER' as const, description: '貸款期數（月）' },
                    },
                    required: ['principal', 'annual_rate', 'term_months'],
                },
            },
            {
                name: 'estimate_tax',
                description: '估算年度所得稅（台灣綜合所得稅）',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        annual_salary: { type: 'NUMBER' as const, description: '年薪' },
                        investment_income: { type: 'NUMBER' as const, description: '投資收入（股利等）' },
                        dependents: { type: 'NUMBER' as const, description: '受扶養人數' },
                    },
                    required: ['annual_salary'],
                },
            },
            {
                name: 'get_financial_advice',
                description: '取得綜合理財建議報告（投資、負債、稅務、退休）',
                parameters: {
                    type: 'OBJECT' as const,
                    properties: {
                        topic: { type: 'STRING' as const, description: '主題：portfolio_review / debt_strategy / tax_optimization / retirement_planning / comprehensive' },
                    },
                },
            },
        ],
    },
];

/**
 * Generate AI response with function calling capability.
 * The AI can autonomously trigger tool calls to perform actions.
 *
 * ## Routing (V3 Privacy-First)
 *
 * Step 1 – Local Tool Parser (Ollama / RTX 4080):
 *   Parses user intent into a structured JSON tool call — no cloud API involved.
 *   Covers all sensitive tools: record_expense, add_event, record_weight,
 *   record_fuel, add_investment, get_schedule, get_spending, get_portfolio,
 *   calculate_loan, estimate_tax, record_exercise, record_sleep.
 *
 *   If Ollama is OFFLINE:
 *     → Returns a privacy-safe offline message.
 *     → Does NOT fall back to cloud for sensitive data.
 *
 * Step 2 – Regular conversation (routedChat):
 *   If no tool intent detected, use routedChat (Ollama → Gemini fallback)
 *   for natural conversation.
 *
 * Step 3 – Gemini Function Calling (cloud, limited scope):
 *   Only for: get_financial_advice (synthesized multi-domain AI analysis).
 *   This tool does NOT transmit raw PII; it reads aggregated data from
 *   Firestore summaries that were already stored locally.
 */
export async function generateAIResponseWithTools(
    userMessage: string,
    userId: string,
    contextPrompt: string,
    activeAgent?: string
): Promise<{ text: string; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> }> {
    const agent = activeAgent || 'butler';

    // ── Step 1: Local Tool Parser (Privacy-First) ─────────────────────────
    // Try to parse tool intent using local Ollama — zero cloud exposure.
    const parseResult = await parseLocalToolCall(userMessage, agent);

    if (parseResult.source === 'offline' && parseResult.toolCall === null) {
        // Ollama offline AND we detected a potential tool trigger in the regex pre-filter.
        // Return a safe message rather than leaking data to cloud.
        logger.warn('[Butler AI] Ollama offline — sensitive tool op blocked for privacy.');
        return {
            text: '🔒 本地 AI 目前離線，無法安全處理含個人資料的操作。\n\n請確認 RTX 4080 工作站已開機並已啟動 Ollama 服務後再試。\n\n一般對話功能仍可透過雲端 AI 回應。',
        };
    }

    if (parseResult.toolCall !== null) {
        // Local parser successfully identified a tool call.
        // Return it for execution by executeTelegramToolCalls() — all local, no cloud.
        logger.info(`[Butler AI] 🏠 Local tool parsed: ${parseResult.toolCall.name} (zero cloud exposure)`);
        return {
            text: '',
            toolCalls: [{ name: parseResult.toolCall.name, args: parseResult.toolCall.args }],
        };
    }

    // ── Step 2: Regular Conversation (Ollama → Gemini fallback) ──────────
    // No tool intent detected; proceed with conversational response.
    const systemPrompt = getAgentPrompt(agent);
    try {
        const cloudFallback = async (): Promise<string> => {
            throw new Error('USE_GEMINI');
        };
        const result = await routedChat(userMessage, agent, [], cloudFallback);
        if (result.backend === 'local') {
            logger.info(`[Butler AI] WithTools via Ollama/${result.model} agent=${agent}`);
            // Layer A: async fact extraction — does NOT block response
            extractAndSaveFacts(userId, agent, userMessage, result.text).catch(() => {/* silent */});
            return { text: result.text };
        }
    } catch (localErr) {
        const msg = (localErr as Error).message;
        if (msg !== 'USE_GEMINI') {
            logger.warn('[Butler AI] Ollama conversation error, falling to Gemini:', msg);
        }
    }

    // ── Step 3: Gemini (non-sensitive / get_financial_advice only) ────────
    // Gemini Function Calling is now restricted to non-sensitive, AI-analysis
    // tools only. Sensitive tools are blocked from this path.
    const CLOUD_ONLY_TOOLS = BUTLER_TOOLS.map(group => ({
        ...group,
        functionDeclarations: group.functionDeclarations.filter(
            fd => !isSensitiveTool(fd.name)
        ),
    }));

    try {
        const client = await getGeminiClient();
        const model = client.getGenerativeModel({
            model: 'gemini-2.5-flash',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: CLOUD_ONLY_TOOLS as any,
        });

        const result = await model.generateContent([
            { text: systemPrompt + contextPrompt + '\n\n如果需要提供財務建議分析，使用 get_financial_advice 工具。' },
            { text: `用戶訊息：${userMessage}` },
        ]);

        const response = result.response;
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) {
            return { text: response.text() };
        }

        const functionCalls = candidate.content.parts
            .filter(part => 'functionCall' in part)
            .map(part => ({
                name: (part as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall.name,
                args: (part as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall.args,
            }));

        if (functionCalls.length > 0) {
            // Paranoia check: reject any sensitive tool that somehow slipped through
            const safeCalls = functionCalls.filter(fc => !isSensitiveTool(fc.name));
            if (safeCalls.length < functionCalls.length) {
                logger.error('[Butler AI] ⚠️  Gemini tried to call a sensitive tool — BLOCKED.', functionCalls.map(f => f.name));
            }
            if (safeCalls.length > 0) {
                logger.info(`[Butler AI] ☁️  Gemini tool calls (non-sensitive): ${safeCalls.map(f => f.name).join(', ')}`);
                return { text: response.text() || '', toolCalls: safeCalls };
            }
        }

        const replyText = response.text();
        logger.info(`[Butler AI] WithTools via Gemini/gemini-2.5-flash agent=${agent}`);
        // Layer A: async fact extraction from cloud response
        extractAndSaveFacts(userId, agent, userMessage, replyText).catch(() => {/* silent */});
        return { text: replyText };
    } catch (err) {
        logger.error('[Butler AI] Gemini Function Calling failed:', err);
        return { text: generateFallbackResponse(userMessage) };
    }
}
