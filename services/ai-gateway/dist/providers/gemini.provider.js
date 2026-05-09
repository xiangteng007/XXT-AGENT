"use strict";
/**
 * Gemini Provider
 *
 * Handles Google Generative AI API interactions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
exports.isReady = isReady;
exports.generateText = generateText;
const generative_ai_1 = require("@google/generative-ai");
const secret_loader_1 = require("./secret-loader");
const SECRET_ID = process.env.GEMINI_SECRET_ID || 'gemini-api-key';
let genAI = null;
let ready = false;
const modelCache = new Map();
async function initialize() {
    try {
        const apiKey = await (0, secret_loader_1.loadSecret)('GEMINI_API_KEY', SECRET_ID);
        if (apiKey) {
            genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            ready = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'Gemini provider initialized' }));
        }
    }
    catch (e) {
        console.error(JSON.stringify({ severity: 'ERROR', message: 'Gemini init failed', error: String(e) }));
    }
    return ready;
}
function isReady() {
    return ready;
}
function getOrCreateModel(modelId) {
    if (!genAI)
        return null;
    if (!modelCache.has(modelId)) {
        const model = genAI.getGenerativeModel({ model: modelId });
        modelCache.set(modelId, model);
    }
    return modelCache.get(modelId) || null;
}
async function generateText(prompt, modelId) {
    const model = getOrCreateModel(modelId);
    if (!model)
        throw new Error('Gemini 未配置。請設定 GEMINI_API_KEY。');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}
