/**
 * OpenAI Provider
 *
 * Handles OpenAI API interactions (GPT-5.x, o4-mini, GPT-4o).
 */

import OpenAI from 'openai';
import { loadSecret } from './secret-loader';

let client: OpenAI | null = null;
let ready = false;

export async function initialize(): Promise<boolean> {
    try {
        const apiKey = await loadSecret('OPENAI_API_KEY', 'OPENAI_API_KEY');
        if (apiKey) {
            client = new OpenAI({ apiKey });
            ready = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'OpenAI provider initialized' }));
        }
    } catch (e) {
        console.log(JSON.stringify({ severity: 'WARNING', message: 'OpenAI not configured', error: String(e) }));
    }
    return ready;
}

export function isReady(): boolean {
    return ready;
}

export async function generateText(prompt: string, modelId: string): Promise<string> {
    if (!client) throw new Error('OpenAI 未配置。請設定 OPENAI_API_KEY。');
    const completion = await client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
    });
    return completion.choices[0]?.message?.content || '';
}
