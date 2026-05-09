"use strict";
/**
 * OpenAI Provider
 *
 * Handles OpenAI API interactions (GPT-5.x, o4-mini, GPT-4o).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
exports.isReady = isReady;
exports.generateText = generateText;
const openai_1 = __importDefault(require("openai"));
const secret_loader_1 = require("./secret-loader");
let client = null;
let ready = false;
async function initialize() {
    try {
        const apiKey = await (0, secret_loader_1.loadSecret)('OPENAI_API_KEY', 'OPENAI_API_KEY');
        if (apiKey) {
            client = new openai_1.default({ apiKey });
            ready = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'OpenAI provider initialized' }));
        }
    }
    catch (e) {
        console.log(JSON.stringify({ severity: 'WARNING', message: 'OpenAI not configured', error: String(e) }));
    }
    return ready;
}
function isReady() {
    return ready;
}
async function generateText(prompt, modelId) {
    if (!client)
        throw new Error('OpenAI 未配置。請設定 OPENAI_API_KEY。');
    const completion = await client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
    });
    return completion.choices[0]?.message?.content || '';
}
