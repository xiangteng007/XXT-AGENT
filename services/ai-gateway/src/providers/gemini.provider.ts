/**
 * Gemini Provider
 *
 * Handles Google Generative AI API interactions.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { loadSecret } from './secret-loader';

const SECRET_ID = process.env.GEMINI_SECRET_ID || 'gemini-api-key';

let genAI: GoogleGenerativeAI | null = null;
let ready = false;
const modelCache = new Map<string, GenerativeModel>();

export async function initialize(): Promise<boolean> {
    try {
        const apiKey = await loadSecret('GEMINI_API_KEY', SECRET_ID);
        if (apiKey) {
            genAI = new GoogleGenerativeAI(apiKey);
            ready = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'Gemini provider initialized' }));
        }
    } catch (e) {
        console.error(JSON.stringify({ severity: 'ERROR', message: 'Gemini init failed', error: String(e) }));
    }
    return ready;
}

export function isReady(): boolean {
    return ready;
}

function getOrCreateModel(modelId: string): GenerativeModel | null {
    if (!genAI) return null;
    if (!modelCache.has(modelId)) {
        const model = genAI.getGenerativeModel({ model: modelId });
        modelCache.set(modelId, model);
    }
    return modelCache.get(modelId) || null;
}

export async function generateText(prompt: string, modelId: string): Promise<string> {
    const model = getOrCreateModel(modelId);
    if (!model) throw new Error('Gemini 未配置。請設定 GEMINI_API_KEY。');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}
