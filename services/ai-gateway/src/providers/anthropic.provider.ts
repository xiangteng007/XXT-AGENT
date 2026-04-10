/**
 * Anthropic Provider
 *
 * Handles Anthropic API interactions (Claude Opus 4.6, Sonnet 4.6, Haiku 3.5).
 */

import Anthropic from '@anthropic-ai/sdk';
import { loadSecret } from './secret-loader';

let client: Anthropic | null = null;
let ready = false;

export async function initialize(): Promise<boolean> {
    try {
        const apiKey = await loadSecret('ANTHROPIC_API_KEY', 'anthropic-api-key');
        if (apiKey) {
            client = new Anthropic({ apiKey });
            ready = true;
            console.log(JSON.stringify({ severity: 'INFO', message: 'Anthropic provider initialized' }));
        }
    } catch (e) {
        console.log(JSON.stringify({ severity: 'WARNING', message: 'Anthropic not configured', error: String(e) }));
    }
    return ready;
}

export function isReady(): boolean {
    return ready;
}

export async function generateText(prompt: string, modelId: string): Promise<string> {
    if (!client) throw new Error('Anthropic 未配置。請設定 ANTHROPIC_API_KEY。');
    const message = await client.messages.create({
        model: modelId,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = message.content[0];
    return block.type === 'text' ? block.text : '';
}
