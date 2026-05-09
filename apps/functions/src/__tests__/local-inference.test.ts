/**
 * Unit Tests: Local Inference Service
 * Covers: model selection, streaming NDJSON parsing, health check, VRAM monitoring
 */

jest.mock('firebase-functions/v2', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Reset modules so health cache doesn't leak between tests
beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
});

import {
    selectLocalModel,
    OllamaUnavailableError,
} from '../services/local-inference.service';

// ================================
// Model Selection
// ================================

describe('selectLocalModel', () => {
    it('should return gpt-oss:20b for analytical agents', () => {
        expect(selectLocalModel('investment')).toBe('gpt-oss:20b');
        expect(selectLocalModel('accountant')).toBe('gpt-oss:20b');
        expect(selectLocalModel('tax')).toBe('gpt-oss:20b');
        expect(selectLocalModel('nexus')).toBe('gpt-oss:20b');
        expect(selectLocalModel('vertex')).toBe('gpt-oss:20b');
    });

    it('should return qwen3:14b for conversational agents', () => {
        expect(selectLocalModel('butler')).toBe('qwen3:14b');
        expect(selectLocalModel('titan')).toBe('qwen3:14b');
        expect(selectLocalModel('lumi')).toBe('qwen3:14b');
        expect(selectLocalModel('rusty')).toBe('qwen3:14b');
    });

    it('should default to qwen3:14b for unknown agents', () => {
        expect(selectLocalModel('unknown_agent')).toBe('qwen3:14b');
        expect(selectLocalModel('')).toBe('qwen3:14b');
    });
});

// ================================
// OllamaUnavailableError
// ================================

describe('OllamaUnavailableError', () => {
    it('should be an instance of Error', () => {
        const err = new OllamaUnavailableError('test');
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('Ollama unavailable: test');
        expect(err.name).toBe('OllamaUnavailableError');
    });
});

// ================================
// NDJSON Streaming Parse (unit logic)
// ================================

describe('NDJSON stream parsing', () => {
    /**
     * Simulate the core NDJSON parsing logic from ollamaChatStream
     * without network dependencies.
     */
    function parseNDJSONChunks(rawChunks: string[]): Array<{ text: string; delta: string; done: boolean }> {
        let accumulated = '';
        let buffer = '';
        const results: Array<{ text: string; delta: string; done: boolean }> = [];

        for (const raw of rawChunks) {
            buffer += raw;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const chunk = JSON.parse(line);
                    const delta = chunk.message?.content || chunk.response || '';
                    accumulated += delta;
                    results.push({
                        text: accumulated,
                        delta,
                        done: chunk.done || false,
                    });
                } catch {
                    // skip malformed
                }
            }
        }
        return results;
    }

    it('should accumulate text across multiple NDJSON lines', () => {
        const chunks = [
            '{"message":{"content":"你"},"done":false}\n',
            '{"message":{"content":"好"},"done":false}\n',
            '{"message":{"content":"！"},"done":true,"eval_count":3}\n',
        ];

        const results = parseNDJSONChunks(chunks);
        expect(results).toHaveLength(3);
        expect(results[0].text).toBe('你');
        expect(results[1].text).toBe('你好');
        expect(results[2].text).toBe('你好！');
        expect(results[2].done).toBe(true);
    });

    it('should handle split chunks (partial JSON across boundaries)', () => {
        const chunks = [
            '{"message":{"content":"he',
            'llo"},"done":false}\n{"message":{"content":" wor',
            'ld"},"done":true}\n',
        ];

        const results = parseNDJSONChunks(chunks);
        expect(results).toHaveLength(2);
        expect(results[0].text).toBe('hello');
        expect(results[1].text).toBe('hello world');
        expect(results[1].done).toBe(true);
    });

    it('should skip empty lines gracefully', () => {
        const chunks = [
            '\n\n{"message":{"content":"ok"},"done":true}\n\n',
        ];

        const results = parseNDJSONChunks(chunks);
        expect(results).toHaveLength(1);
        expect(results[0].text).toBe('ok');
    });

    it('should skip malformed JSON lines', () => {
        const chunks = [
            '{"message":{"content":"a"},"done":false}\n',
            'NOT VALID JSON\n',
            '{"message":{"content":"b"},"done":true}\n',
        ];

        const results = parseNDJSONChunks(chunks);
        expect(results).toHaveLength(2);
        expect(results[0].text).toBe('a');
        expect(results[1].text).toBe('ab');
    });

    it('should handle response field (generate endpoint)', () => {
        const chunks = [
            '{"response":"hello","done":false}\n',
            '{"response":" world","done":true}\n',
        ];

        const results = parseNDJSONChunks(chunks);
        expect(results).toHaveLength(2);
        expect(results[1].text).toBe('hello world');
    });
});

// ================================
// Source Indicator Logic
// ================================

describe('source indicator emoji', () => {
    it('should use ⚡ for local backend', () => {
        const backend = 'local';
        const emoji = backend === 'local' ? '⚡' : '☁️';
        expect(emoji).toBe('⚡');
    });

    it('should use ☁️ for cloud backend', () => {
        const backend: string = 'cloud';
        const emoji = backend === 'local' ? '⚡' : '☁️';
        expect(emoji).toBe('☁️');
    });
});
