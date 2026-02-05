"use strict";
/**
 * Butler AI Service
 *
 * Provides intelligent response generation for the Personal Butler
 * using Gemini AI with fallback to keyword matching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIResponse = generateAIResponse;
exports.isAIAvailable = isAIAvailable;
const generative_ai_1 = require("@google/generative-ai");
const secret_manager_1 = require("@google-cloud/secret-manager");
const secretManager = new secret_manager_1.SecretManagerServiceClient();
let geminiClient = null;
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
async function getGeminiClient() {
    if (geminiClient)
        return geminiClient;
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'xxt-agent';
    const secretName = `projects/${projectId}/secrets/GEMINI_API_KEY/versions/latest`;
    try {
        const [version] = await secretManager.accessSecretVersion({ name: secretName });
        const apiKey = version.payload?.data?.toString() || '';
        geminiClient = new generative_ai_1.GoogleGenerativeAI(apiKey);
        console.log('[Butler AI] Gemini client initialized');
        return geminiClient;
    }
    catch (err) {
        console.error('[Butler AI] Failed to get Gemini API key:', err);
        throw new Error('Gemini API key not available');
    }
}
/**
 * Generate AI response for user message
 */
async function generateAIResponse(userMessage, userId, context) {
    try {
        const client = await getGeminiClient();
        const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
        // Build conversation context
        let contextPrompt = '';
        if (context?.previousMessages?.length) {
            contextPrompt = '\n\n最近的對話：\n' + context.previousMessages.slice(-3).join('\n');
        }
        const result = await model.generateContent([
            { text: BUTLER_SYSTEM_PROMPT + contextPrompt },
            { text: `用戶訊息：${userMessage}` },
        ]);
        const response = result.response.text();
        console.log(`[Butler AI] Generated response for user ${userId || 'unknown'}`);
        return response;
    }
    catch (err) {
        console.error('[Butler AI] AI generation failed, using fallback:', err);
        return generateFallbackResponse(userMessage);
    }
}
/**
 * Fallback keyword-based response when AI fails
 */
function generateFallbackResponse(text) {
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
async function isAIAvailable() {
    try {
        await getGeminiClient();
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=butler-ai.service.js.map