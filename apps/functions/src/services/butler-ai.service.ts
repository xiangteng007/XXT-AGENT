/**
 * Butler AI Service
 * 
 * Provides intelligent response generation for the Personal Butler
 * using Gemini AI or OpenAI GPT with fallback to keyword matching.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { getButlerContext } from './butler-data.service';

const secretManager = new SecretManagerServiceClient();
let geminiClient: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

// Available AI models
export type AIModel = 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gpt-4o' | 'gpt-4o-mini';

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
3. 🚗 車輛管理 - Jimny JB74 保養、油耗追蹤
4. 🏃 健康記錄 - 運動、睡眠、體重追蹤
5. 🏢 工作管理 - 專案狀態、客戶追蹤

## 回應格式
- 對於查詢類請求，提供清晰的狀態摘要
- 對於操作類請求，確認操作並提供下一步建議
- 如果無法處理，友善地說明並提供替代方案

請根據用戶訊息提供適當的回應。`;

/**
 * Initialize Gemini client
 */
async function getGeminiClient(): Promise<GoogleGenerativeAI> {
    if (geminiClient) return geminiClient;

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'xxt-agent';
    const secretName = `projects/${projectId}/secrets/GEMINI_API_KEY/versions/latest`;

    try {
        const [version] = await secretManager.accessSecretVersion({ name: secretName });
        const apiKey = version.payload?.data?.toString() || '';
        geminiClient = new GoogleGenerativeAI(apiKey);
        console.log('[Butler AI] Gemini client initialized');
        return geminiClient;
    } catch (err) {
        console.error('[Butler AI] Failed to get Gemini API key:', err);
        throw new Error('Gemini API key not available');
    }
}

/**
 * Initialize OpenAI client
 */
async function getOpenAIClient(): Promise<OpenAI> {
    if (openaiClient) return openaiClient;

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'xxt-agent';
    const secretName = `projects/${projectId}/secrets/OPENAI_API_KEY/versions/latest`;

    try {
        const [version] = await secretManager.accessSecretVersion({ name: secretName });
        const apiKey = version.payload?.data?.toString() || '';
        openaiClient = new OpenAI({ apiKey });
        console.log('[Butler AI] OpenAI client initialized');
        return openaiClient;
    } catch (err) {
        console.error('[Butler AI] Failed to get OpenAI API key:', err);
        throw new Error('OpenAI API key not available');
    }
}

/**
 * Generate AI response using Gemini
 */
async function generateGeminiResponse(
    userMessage: string,
    model: 'gemini-1.5-flash' | 'gemini-1.5-pro',
    contextPrompt: string
): Promise<string> {
    const client = await getGeminiClient();
    const geminiModel = client.getGenerativeModel({ model });

    const result = await geminiModel.generateContent([
        { text: BUTLER_SYSTEM_PROMPT + contextPrompt },
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
    contextPrompt: string
): Promise<string> {
    const client = await getOpenAIClient();

    const completion = await client.chat.completions.create({
        model: model,
        messages: [
            { role: 'system', content: BUTLER_SYSTEM_PROMPT + contextPrompt },
            { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '抱歉，我無法產生回應。';
}

/**
 * Generate AI response for user message
 */
export async function generateAIResponse(
    userMessage: string,
    userId?: string,
    context?: {
        previousMessages?: string[];
        userProfile?: Record<string, unknown>;
        model?: AIModel;
    }
): Promise<string> {
    const selectedModel = context?.model || 'gemini-1.5-flash';

    try {
        // Build conversation context
        let contextPrompt = '';
        if (context?.previousMessages?.length) {
            contextPrompt = '\n\n最近的對話：\n' + context.previousMessages.slice(-3).join('\n');
        }

        // Fetch personalized data from Firestore
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
                console.warn('[Butler AI] Failed to fetch personal data, proceeding without:', dataErr);
            }
        }

        let response: string;

        if (selectedModel.startsWith('gpt')) {
            response = await generateOpenAIResponse(
                userMessage,
                selectedModel as 'gpt-4o' | 'gpt-4o-mini',
                contextPrompt
            );
        } else {
            response = await generateGeminiResponse(
                userMessage,
                selectedModel as 'gemini-1.5-flash' | 'gemini-1.5-pro',
                contextPrompt
            );
        }

        console.log(`[Butler AI] Generated response using ${selectedModel} for user ${userId || 'unknown'}`);
        return response;

    } catch (err) {
        console.error('[Butler AI] AI generation failed, using fallback:', err);
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
    return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gpt-4o', 'gpt-4o-mini'];
}

// ================================
// Gemini Function Calling (Tool Use)
// ================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { SchemaType } from '@google/generative-ai';

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
                    type: SchemaType.OBJECT,
                    properties: {
                        amount: { type: SchemaType.NUMBER, description: '金額' },
                        description: { type: SchemaType.STRING, description: '描述（例如午餐、加油）' },
                        category: { type: SchemaType.STRING, description: '分類：餐飲/交通/購物/醫療/娛樂/日用品/其他' },
                    },
                    required: ['amount', 'description'],
                },
            },
            {
                name: 'record_weight',
                description: '記錄用戶的體重',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        weight: { type: SchemaType.NUMBER, description: '體重（公斤）' },
                    },
                    required: ['weight'],
                },
            },
            {
                name: 'add_event',
                description: '新增一個行程到日曆',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        title: { type: SchemaType.STRING, description: '事件標題' },
                        date: { type: SchemaType.STRING, description: '日期（YYYY-MM-DD）' },
                        time: { type: SchemaType.STRING, description: '時間（HH:mm）' },
                    },
                    required: ['title', 'date'],
                },
            },
            {
                name: 'get_schedule',
                description: '查詢用戶的行程',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        date: { type: SchemaType.STRING, description: '要查詢的日期（YYYY-MM-DD），空白表示今天' },
                    },
                },
            },
            {
                name: 'get_spending',
                description: '查詢用戶的支出摘要',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        month: { type: SchemaType.NUMBER, description: '月份（1-12），空白表示本月' },
                    },
                },
            },
            {
                name: 'record_fuel',
                description: '記錄車輛加油',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        liters: { type: SchemaType.NUMBER, description: '公升數' },
                        price_per_liter: { type: SchemaType.NUMBER, description: '每公升價格' },
                    },
                    required: ['liters'],
                },
            },
        ],
    },
];

/**
 * Generate AI response with function calling capability.
 * The AI can autonomously trigger tool calls to perform actions.
 */
export async function generateAIResponseWithTools(
    userMessage: string,
    userId: string,
    contextPrompt: string
): Promise<{ text: string; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> }> {
    try {
        const client = await getGeminiClient();
        const model = client.getGenerativeModel({
            model: 'gemini-1.5-flash',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: BUTLER_TOOLS as any,
        });

        const result = await model.generateContent([
            { text: BUTLER_SYSTEM_PROMPT + contextPrompt + '\n\n當用戶想要記錄數據或查詢資訊時，使用提供的工具函數來執行操作。' },
            { text: `用戶訊息：${userMessage}` },
        ]);

        const response = result.response;
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) {
            return { text: response.text() };
        }

        // Check for function calls
        const functionCalls = candidate.content.parts
            .filter(part => 'functionCall' in part)
            .map(part => ({
                name: (part as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall.name,
                args: (part as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall.args,
            }));

        if (functionCalls.length > 0) {
            return { text: response.text() || '', toolCalls: functionCalls };
        }

        return { text: response.text() };
    } catch (err) {
        console.error('[Butler AI] Function Calling failed:', err);
        return { text: generateFallbackResponse(userMessage) };
    }
}
