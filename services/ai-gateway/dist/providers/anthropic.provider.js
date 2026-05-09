"use strict";
/**
 * Anthropic Provider
 *
 * Handles Anthropic API interactions (Claude Opus 4.6, Sonnet 4.6, Haiku 3.5).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
exports.isReady = isReady;
exports.generateText = generateText;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const secret_loader_1 = require("./secret-loader");
let client = null;
let ready = false;
async function initialize() {
    try {
        const apiKey = await (0, secret_loader_1.loadSecret)('ANTHROPIC_API_KEY', 'anthropic-api-key');
        if (apiKey) {
            client = new sdk_1.default({ apiKey });
            ready = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'Anthropic provider initialized' }));
        }
    }
    catch (e) {
        console.log(JSON.stringify({ severity: 'WARNING', message: 'Anthropic not configured', error: String(e) }));
    }
    return ready;
}
function isReady() {
    return ready;
}
async function generateText(prompt, modelId) {
    if (!client)
        throw new Error('Anthropic 未配置。請設定 ANTHROPIC_API_KEY。');
    const message = await client.messages.create({
        model: modelId,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = message.content[0];
    return block.type === 'text' ? block.text : '';
}
